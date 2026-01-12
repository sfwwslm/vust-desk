import React, { useState, useEffect, useCallback } from "react";

import { WebsiteGroup } from "@/features/Panel/types";
import * as panelDb from "@/services/panelDb";
import Loading from "@/components/common/Loading";
import GroupModal from "@/features/Panel/components/GroupModal";
import {
  IoAddCircleOutline,
  IoPencil,
  IoTrash,
  IoCloseSharp,
  IoCloudUploadOutline,
  IoReorderTwoOutline,
} from "react-icons/io5";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import {
  SettingsOverlay,
  SettingsModalContainer,
  Sidebar,
  Content,
  MenuList,
  MenuItem,
  CloseButton,
  Title,
  ModalHeader,
  MainContentWrapper,
} from "@/components/layout/SettingsLayout.styles";
import {
  VscGroupByRefType,
  VscSettings,
  VscBrowser,
  VscPaintcan,
} from "react-icons/vsc";
import { useModal } from "@/contexts/ModalContext";
import { useAuth } from "@/contexts/AuthContext";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import LoadingOverlay from "@/components/common/LoadingOverlay/LoadingOverlay";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BrowserSettings from "@/features/Settings/BrowserSettings";
import {
  ActionButton,
  ActionButtons,
  AddButton,
  GroupList,
  GroupListItem,
  GroupManagementContainer,
  GroupName,
  DragHandle,
  Toolbar,
  BookmarkImportContainer,
  ImportButton,
} from "./ConfigModal.styles";
import PanelPersonalizationSettings from "./PanelPersonalizationSettings";

/**
 * @interface BookmarkItem
 * @description 定义从后端返回的单个书签项的结构
 */
interface BookmarkItem {
  title: string;
  url: string;
}

/**
 * @interface BookmarkGroup
 * @description 定义从后端返回的书签分组的结构
 */
interface BookmarkGroup {
  name: string;
  items: BookmarkItem[];
}

// 可排序的列表项组件
const SortableGroupItem: React.FC<{
  group: WebsiteGroup;
  onEdit: (group: WebsiteGroup) => void;
  onDelete: (uuid: string, name: string) => void;
}> = ({ group, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.uuid });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <GroupListItem ref={setNodeRef} style={style} $isDragging={isDragging}>
      <ActionButtons>
        <DragHandle {...attributes} {...listeners}>
          <IoReorderTwoOutline />
        </DragHandle>
        <GroupName>{group.name}</GroupName>
      </ActionButtons>
      <ActionButtons>
        <ActionButton className="edit-btn" onClick={() => onEdit(group)}>
          <IoPencil />
        </ActionButton>
        <ActionButton
          className="delete-btn"
          onClick={() => onDelete(group.uuid, group.name)}
        >
          <IoTrash />
        </ActionButton>
      </ActionButtons>
    </GroupListItem>
  );
};

interface NavigationConfigModalProps {
  isOpen: boolean;
  onClose: (refresh?: boolean) => void;
}

/** 定义侧边栏菜单的 Key 类型 */
type MenuKey =
  | "group_management"
  | "bookmark_import"
  | "browser_settings"
  | "personalization";

/**
 * @component ConfigModal
 * @description 导航配置模态框，提供分组管理和书签导入功能
 * @param {NavigationConfigModalProps} props - 组件 props
 */
const ConfigModal: React.FC<NavigationConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { openAlert, openConfirm } = useModal();
  const { activeUser } = useAuth(); // 获取当前活跃用户

  const [activeMenu, setActiveMenu] = useState<MenuKey>("group_management");
  const [dataChanged, setDataChanged] = useState(false);
  const [groups, setGroups] = useState<WebsiteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WebsiteGroup | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 鼠标移动一小段距离后才识别为拖拽，防止误触
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  /**
   * @function loadGroups
   * @description 从数据库加载所有分组数据
   */
  const loadGroups = useCallback(async () => {
    if (!activeUser?.uuid) return; // 确保 activeUser 存在
    setIsLoading(true);
    // 解构返回的对象，只获取 groups 数组
    const { groups: data } = await panelDb.getPanelData(activeUser.uuid);
    setGroups(data);
    setIsLoading(false);
  }, [activeUser]); // 依赖 activeUser

  // 模态框打开时加载数据并重置状态
  useEffect(() => {
    if (isOpen) {
      loadGroups();
      setActiveMenu("group_management"); // 每次打开时默认显示分组管理
    }
  }, [isOpen, loadGroups]);

  /**
   * @function handleCloseOperation
   * @description 关闭模态框，并根据数据是否变化决定是否需要刷新主界面
   */
  const handleCloseOperation = () => {
    onClose(dataChanged);
    setDataChanged(false); // 重置状态
  };

  /**
   * @function handleAddGroup
   * @description 打开用于添加新分组的模态框
   */
  const handleAddGroup = () => {
    setEditingGroup(null);
    setIsGroupModalOpen(true);
  };

  /**
   * @function handleEditGroup
   * @description 打开用于编辑指定分组的模态框
   * @param {WebsiteGroup} group - 要编辑的分组对象
   */
  const handleEditGroup = (group: WebsiteGroup) => {
    setEditingGroup(group);
    setIsGroupModalOpen(true);
  };

  /**
   * @function handleConfirmDelete
   * @description 确认删除分组后的回调，执行删除操作并刷新列表
   * @param {string} groupUuid - 要删除的分组UUID
   */
  const handleConfirmDelete = useCallback(
    async (groupUuid: string) => {
      await panelDb.deleteGroup(groupUuid);
      await loadGroups();
      setDataChanged(true);
    },
    [loadGroups],
  );

  /**
   * @function handleDeleteGroup
   * @description 点击删除按钮时，弹出确认框
   * @param {string} uuid - 要删除的分组UUID
   * @param {string} name - 要删除的分组名称
   */
  const handleDeleteGroup = (uuid: string, name: string) => {
    openConfirm({
      title: t("panel.deleteGroupTitle"),
      message: `${t("panel.deleteGroupMessagePrefix")}"${name}"${t(
        "panel.deleteGroupMessageSuffix",
      )}`,
      onConfirm: () => handleConfirmDelete(uuid),
    });
  };
  /**
   * @function handleSaveGroup
   * @description 保存（新增或更新）分组信息
   * @param {object} groupData - 分组数据
   */
  const handleSaveGroup = useCallback(
    async (groupData: Partial<Omit<WebsiteGroup, "items" | "user_uuid">>) => {
      if (!activeUser?.uuid) {
        openAlert({ title: "错误", message: "无法确定当前用户！" });
        return;
      }

      const isNameDuplicate = groups.some(
        (g) => g.name === groupData.name && g.uuid !== groupData.uuid,
      );

      if (isNameDuplicate) {
        openAlert({
          title: "操作失败",
          message: "分组名称已存在，请使用其他名称。",
        });
        return;
      }

      const dataToSave: Partial<WebsiteGroup> = { ...groupData };

      // 如果是新增，则关联到当前活动用户
      if (!dataToSave.uuid) {
        dataToSave.sort_order = groups.length;
        dataToSave.user_uuid = activeUser.uuid;
      }

      await panelDb.saveGroup(dataToSave);
      await loadGroups(); // 重新加载以获取最新数据
      setIsGroupModalOpen(false);
      setDataChanged(true);
    },
    [groups, loadGroups, openAlert, activeUser],
  );

  /**
   * @function handleImportBookmarks
   * @description 处理书签导入逻辑：选择文件、调用后端解析、数据入库
   */
  const handleImportBookmarks = async () => {
    if (!activeUser?.uuid) return;
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });

      if (typeof selectedPath === "string") {
        setIsImporting(true);
        const importedGroups: BookmarkGroup[] = await invoke(
          "bookmark_parser",
          {
            path: selectedPath,
          },
        );

        if (
          importedGroups.length === 0 ||
          importedGroups[0].items.length === 0
        ) {
          setIsImporting(false);
          openAlert({
            title: t("panel.importErrorTitle"),
            message: "未在文件中找到有效的书签。",
          });
          return;
        }

        let newGroupCount = 0;
        let newItemCount = 0;
        const existingGroupNames = new Set(groups.map((g) => g.name));

        for (const importedGroup of importedGroups) {
          if (!existingGroupNames.has(importedGroup.name)) {
            await panelDb.saveGroup({
              name: importedGroup.name,
              user_uuid: activeUser.uuid,
            });
            newGroupCount++;
          }
        }

        // 重新获取所有分组数据（包含新创建的）以拿到 ID
        const { groups: updatedGroups } = await panelDb.getPanelData(
          activeUser.uuid,
        );

        // 遍历导入的数据，将网站项添加到对应的分组中
        for (const importedGroup of importedGroups) {
          const targetGroup = updatedGroups.find(
            (g) => g.name === importedGroup.name,
          );
          if (targetGroup) {
            for (const item of importedGroup.items) {
              await panelDb.saveItem({
                group_uuid: targetGroup.uuid,
                user_uuid: activeUser.uuid,
                title: item.title,
                url: item.url,
                default_icon: "ion:globe-outline",
              });
              newItemCount++;
            }
          }
        }

        setIsImporting(false);
        setDataChanged(true);
        await loadGroups(); // 刷新分组列表，以防用户切回分组管理

        openAlert({
          title: t("panel.importSuccessTitle"),
          message: t("panel.importSuccessMessage", {
            groupCount: newGroupCount,
            itemCount: newItemCount,
          }),
        });
      }
    } catch (err) {
      setIsImporting(false);
      openAlert({
        title: t("panel.importErrorTitle"),
        message: String(err),
      });
    }
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setGroups((items) => {
        const oldIndex = items.findIndex((item) => item.uuid === active.id);
        const newIndex = items.findIndex((item) => item.uuid === over.id);
        const newOrderedGroups = arrayMove(items, oldIndex, newIndex);
        panelDb.updateGroupsOrder(newOrderedGroups);
        setDataChanged(true);
        return newOrderedGroups;
      });
    }
  }, []);

  /**
   * @function renderContent
   * @description 根据当前激活的菜单项，渲染不同的内容组件
   */
  const renderContent = () => {
    if (isLoading) return <Loading />;

    switch (activeMenu) {
      case "group_management":
        return (
          <GroupManagementContainer className="group-management-container">
            <Toolbar>
              <AddButton onClick={handleAddGroup}>
                <IoAddCircleOutline /> {t("panel.addGroup")}
              </AddButton>
            </Toolbar>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={groups.map((g) => g.uuid)}
                strategy={verticalListSortingStrategy}
              >
                <GroupList>
                  {groups.map((group) => (
                    <SortableGroupItem
                      key={group.uuid}
                      group={group}
                      onEdit={handleEditGroup}
                      onDelete={handleDeleteGroup}
                    />
                  ))}
                </GroupList>
              </SortableContext>
            </DndContext>
          </GroupManagementContainer>
        );
      case "bookmark_import":
        return (
          <BookmarkImportContainer className="bookmark-import-container">
            <ImportButton onClick={handleImportBookmarks}>
              <IoCloudUploadOutline />
              {t("panel.importButton")}
            </ImportButton>
          </BookmarkImportContainer>
        );
      case "browser_settings":
        return <BrowserSettings />;
      case "personalization":
        return <PanelPersonalizationSettings />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <SettingsOverlay
          className="panel-config-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseOperation}
        >
          <SettingsModalContainer
            className="panel-config-modal-container"
            initial={{ y: -50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -50, opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <Title>
                <VscSettings />
                {t("panel.configLong")}
              </Title>
              <CloseButton onClick={handleCloseOperation}>
                <IoCloseSharp />
              </CloseButton>
            </ModalHeader>

            <MainContentWrapper>
              <Sidebar>
                <MenuList>
                  <MenuItem
                    className="panel-config-menu-item-group"
                    $isActive={activeMenu === "group_management"}
                    onClick={() => setActiveMenu("group_management")}
                  >
                    <VscGroupByRefType />
                    {t("panel.groupManagement")}
                  </MenuItem>
                  <MenuItem
                    className="panel-config-menu-item-import"
                    $isActive={activeMenu === "bookmark_import"}
                    onClick={() => setActiveMenu("bookmark_import")}
                  >
                    <IoCloudUploadOutline />
                    {t("panel.bookmarkImport")}
                  </MenuItem>
                  {/* 浏览器设置菜单项 */}
                  <MenuItem
                    className="panel-config-menu-item-browser"
                    $isActive={activeMenu === "browser_settings"}
                    onClick={() => setActiveMenu("browser_settings")}
                  >
                    <VscBrowser />
                    {t("panel.browserSettings")}
                  </MenuItem>
                  <MenuItem
                    className="panel-config-menu-item-personalization"
                    $isActive={activeMenu === "personalization"}
                    onClick={() => setActiveMenu("personalization")}
                  >
                    <VscPaintcan />
                    {t("panel.personalization")}
                  </MenuItem>
                </MenuList>
              </Sidebar>
              <Content className="panel-config-content">
                <LoadingOverlay
                  isOpen={isImporting}
                  text={t("panel.importing")}
                />
                {renderContent()}
              </Content>
            </MainContentWrapper>

            <GroupModal
              isOpen={isGroupModalOpen}
              onClose={() => setIsGroupModalOpen(false)}
              onSave={handleSaveGroup}
              group={editingGroup}
            />
          </SettingsModalContainer>
        </SettingsOverlay>
      )}
    </AnimatePresence>
  );
};

export default ConfigModal;
