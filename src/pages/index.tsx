import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  WebsiteGroup,
  WebsiteItem,
  SearchEngine,
} from "@/features/Panel/types";
import EditWebsiteItemModal from "@/features/Panel/components/EditWebsiteItemModal";
import * as panelDb from "@/services/panelDb";
import Loading from "@/components/common/Loading";
import WebsiteGroupSection from "@/features/Panel/components/WebsiteGroupSection";
import ContextMenu from "@/features/Panel/components/ContextMenu";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import * as log from "@tauri-apps/plugin-log";
import {
  PanelIndexContainer,
  PanelPageHeader,
  HeaderSection,
  Title,
  SearchContainer,
  SearchInput,
  SearchIconsContainer,
  ClearIcon,
  SearchButtonIcon,
  PanelPageActionsContainer,
  SearchEngineIcon,
} from "@/styles/panel/index.styles";
import { useTranslation } from "react-i18next";
import ConfigModal from "@/features/Panel/components/ConfigModal";
import { useModal } from "@/contexts/ModalContext";
import DynamicIcon from "@/components/common/DynamicIcon";
import { StyledButton } from "@/components/styled/StyledButton";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { IconRefreshProvider } from "@/contexts/IconRefreshContext";
import SearchEngineManagementModal from "@/features/Panel/components/SearchEngineManagementModal";
import useLocalStorage from "@/hooks/useLocalStorage";
import { openLink } from "@/utils/browser";
import {
  PanelSettingsProvider,
  usePanelSettings,
} from "@/contexts/PanelSettingsContext";

// --- 内置搜索引擎 ---
const builtInSearchEngines: SearchEngine[] = [
  {
    id: "bing",
    uuid: "bing-builtin",
    name: "Bing",
    url_template: "https://cn.bing.com/search?q=%s",
    default_icon: "logos:bing",
    is_deletable: 0,
  },
  {
    id: "google",
    uuid: "google-builtin",
    name: "Google",
    url_template: "https://www.google.com/search?q=%s",
    default_icon: "devicon:google",
    is_deletable: 0,
  },
];

const PanelPageContent: React.FC = () => {
  const { t } = useTranslation();
  const { environment, toggleEnvironment } = useEnvironment();
  // 从 useAuth 中获取 dataVersion，认领完成后刷新界面
  const { activeUser, dataVersion } = useAuth();
  const { sideMargin } = usePanelSettings();
  const [groups, setGroups] = useState<WebsiteGroup[]>([]);
  const [items, setItems] = useState<WebsiteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavConfigModalOpen, setIsNavConfigModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WebsiteItem | null>(null);
  const [targetGroupUuid, setTargetGroupUuid] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: WebsiteItem;
  } | null>(null);

  const [allSearchEngines, setAllSearchEngines] = useState<SearchEngine[]>([]);
  const [activeEngineUuid, setActiveEngineUuid] = useLocalStorage<string>(
    "activeSearchEngineUuid",
    "bing-builtin",
  );
  const [isEngineModalOpen, setIsEngineModalOpen] = useState(false);

  const activeSearchEngine = useMemo(() => {
    return (
      allSearchEngines.find((engine) => engine.uuid === activeEngineUuid) ||
      builtInSearchEngines[0]
    );
  }, [allSearchEngines, activeEngineUuid]);

  const { openAlert, openConfirm } = useModal();

  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scrollPosRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const showAlert = (title: string, message: string) => {
    openAlert({ title, message });
  };

  const loadSearchEngines = useCallback(async () => {
    if (!activeUser?.uuid) return;
    const customEngines = await panelDb.getSearchEngines(activeUser.uuid);
    const dbDefaultEngine = await panelDb.getDefaultSearchEngine(
      activeUser.uuid,
    );
    const combined = [...builtInSearchEngines, ...customEngines];
    setAllSearchEngines(combined);

    if (dbDefaultEngine) {
      setActiveEngineUuid(dbDefaultEngine.uuid);
    } else {
      const exists = combined.some((e) => e.uuid === activeEngineUuid);
      if (!exists) {
        setActiveEngineUuid("bing-builtin");
      }
    }
  }, [activeUser, setActiveEngineUuid]);

  const loadData = useCallback(async () => {
    if (!activeUser?.uuid) return;
    setIsLoading(true);
    await Promise.all([
      (async () => {
        const { groups: fetchedGroups, items: fetchedItems } =
          await panelDb.getPanelData(activeUser.uuid);
        setGroups(fetchedGroups);
        setItems(fetchedItems);
      })(),
      loadSearchEngines(),
    ]);
    setIsLoading(false);
  }, [activeUser, loadSearchEngines]);

  useEffect(() => {
    scrollContainerRef.current = document.querySelector(".app-main");
    loadData();
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [loadData, dataVersion]);

  useLayoutEffect(() => {
    if (scrollContainerRef.current && scrollPosRef.current !== null) {
      scrollContainerRef.current.scrollTop = scrollPosRef.current;
      scrollPosRef.current = null;
    }
  }, [groups, items]);

  const handleNavConfigModalClose = (refresh?: boolean) => {
    setIsNavConfigModalOpen(false);
    if (refresh) {
      loadData();
    }
  };

  const handleSearch = async () => {
    if (searchTerm.trim()) {
      const template = activeSearchEngine.url_template;
      const encodedSearchTerm = encodeURIComponent(searchTerm);
      const searchUrl = template.includes("%s")
        ? template.replace("%s", encodedSearchTerm)
        : template + encodedSearchTerm;
      await openLink(searchUrl);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleCardClick = async (item: WebsiteItem) => {
    const url = environment === "lan" && item.url_lan ? item.url_lan : item.url;
    if (url) {
      try {
        await openLink(url);
      } catch (error: any) {
        log.error("Failed to open URL:", error);
        showAlert(
          "打开链接失败",
          `无法打开 URL "${url}"。\n\n错误详情: ${error.message || error}`,
        );
      }
    } else {
      showAlert("无效链接", `网站项 "${item.title}" 没有配置可用的URL。`);
    }
  };

  const handleSaveItem = useCallback(
    async (itemData: Partial<WebsiteItem>) => {
      if (scrollContainerRef.current) {
        scrollPosRef.current = scrollContainerRef.current.scrollTop;
      }
      const dataToSave = { ...itemData };
      if (!dataToSave.uuid) {
        if (!activeUser?.uuid) {
          showAlert("错误", "无法确定当前用户，无法保存项目。");
          return;
        }
        dataToSave.user_uuid = activeUser.uuid;
        const itemsInGroup = items.filter(
          (i) => i.group_uuid === dataToSave.group_uuid,
        );
        dataToSave.sort_order = itemsInGroup.length;
      }
      await panelDb.saveItem(dataToSave);
      await loadData();
    },
    [loadData, items, activeUser, showAlert],
  );

  const handleContextMenu = (e: React.MouseEvent, item: WebsiteItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleContextDelete = () => {
    if (contextMenu) {
      const itemToDelete = contextMenu.item;
      openConfirm({
        title: "确认删除网站项",
        message: `您确定要删除 "${itemToDelete.title}" 吗？此操作不可撤销。`,
        onConfirm: async () => {
          if (scrollContainerRef.current) {
            scrollPosRef.current = scrollContainerRef.current.scrollTop;
          }
          await panelDb.deleteItem(itemToDelete.uuid);
          await loadData();
        },
      });
    }
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex(
          (item) => item.uuid === active.id,
        );
        const newIndex = currentItems.findIndex(
          (item) => item.uuid === over.id,
        );

        // 确保拖拽在同一个分组内
        if (
          currentItems[oldIndex].group_uuid !==
          currentItems[newIndex].group_uuid
        ) {
          return currentItems;
        }

        const newOrderedItems = arrayMove(currentItems, oldIndex, newIndex);

        panelDb.updateItemsOrder(newOrderedItems);
        return newOrderedItems;
      });
    }
  }, []);

  const handleActiveEngineChange = async (engine: SearchEngine) => {
    setActiveEngineUuid(engine.uuid);
    if (activeUser) {
      if (engine.is_deletable === 1) {
        await panelDb.setActiveSearchEngine(engine.uuid, activeUser.uuid);
      } else {
        await panelDb.clearDefaultSearchEngine(activeUser.uuid);
      }
    }
  };

  /**
   * 1.  遍历所有分组。
   * 2.  检查每个分组的名称是否匹配搜索词。
   * 3.  如果分组名称匹配，则该分组及其**所有**网站项都应该被显示。
   * 4.  如果分组名称不匹配，再检查该分组下的网站项标题是否匹配搜索词。如果至少有一个匹配，则显示该分组，但只包含那些匹配的网站项。
   * 5.  如果分组名称和其下的所有网站项标题都不匹配，则该分组不应被显示。
   */
  const filteredAndGroupedData = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();

    if (!lowerSearchTerm) {
      // 如果没有搜索词，则返回所有分组及其对应的网站项
      return groups.map((group) => ({
        ...group,
        items: items.filter((item) => item.group_uuid === group.uuid),
      }));
    }

    return groups
      .map((group) => {
        // 获取当前分组下的所有网站项
        const itemsInGroup = items.filter(
          (item) => item.group_uuid === group.uuid,
        );

        // 检查分组名称是否匹配
        const isGroupMatch = group.name.toLowerCase().includes(lowerSearchTerm);

        // 筛选出标题匹配的网站项
        const matchingItems = itemsInGroup.filter((item) =>
          item.title.toLowerCase().includes(lowerSearchTerm),
        );
        // 如果分组名称匹配，则返回该分组和它的所有网站项
        if (isGroupMatch) {
          return { ...group, items: itemsInGroup };
        }
        // 如果分组名称不匹配，但有网站项匹配，则返回该分组和匹配的网站项
        if (matchingItems.length > 0) {
          return { ...group, items: matchingItems };
        }
        // 如果都不匹配，则不返回该分组
        return null;
      })
      .filter(
        (group): group is WebsiteGroup & { items: WebsiteItem[] } =>
          group !== null,
      );
  }, [groups, items, searchTerm]);

  if (isLoading) return <Loading />;

  return (
    <>
      <PanelIndexContainer
        className="panel-index-container"
        style={
          { "--panel-side-margin-percent": sideMargin } as React.CSSProperties
        }
      >
        <PanelPageActionsContainer className="panel-page-actions-container">
          <StyledButton variant="ghost" onClick={toggleEnvironment}>
            <DynamicIcon
              defaultIcon={
                environment === "lan" ? "IoHomeOutline" : "IoPlanetOutline"
              }
            />
            {environment === "lan" ? t("panel.lan") : t("panel.wan")}
          </StyledButton>
          <StyledButton
            variant="ghost"
            onClick={() => setIsNavConfigModalOpen(true)}
          >
            <DynamicIcon defaultIcon={"IoSettingsOutline"} />
            {t("panel.config")}
          </StyledButton>
        </PanelPageActionsContainer>

        <PanelPageHeader className="panel-page-header">
          <HeaderSection>
            <Title>{t("panel.title")}</Title>
            <SearchContainer>
              <SearchEngineIcon onClick={() => setIsEngineModalOpen(true)}>
                <DynamicIcon
                  defaultIcon={activeSearchEngine.default_icon}
                  localIconPath={activeSearchEngine.local_icon_path}
                />
              </SearchEngineIcon>
              <SearchInput
                id="panel-search-input"
                placeholder={t("panel.searchText")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <SearchIconsContainer>
                {searchTerm && <ClearIcon onClick={() => setSearchTerm("")} />}
                <SearchButtonIcon onClick={handleSearch} />
              </SearchIconsContainer>
            </SearchContainer>
          </HeaderSection>
        </PanelPageHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {filteredAndGroupedData.map((group) => (
            <WebsiteGroupSection
              key={group.uuid}
              group={group}
              items={group.items}
              onAddItem={(groupUuid) => {
                setEditingItem(null);
                setTargetGroupUuid(groupUuid);
                setIsItemModalOpen(true);
              }}
              onCardClick={handleCardClick}
              onContextMenu={handleContextMenu}
            />
          ))}
        </DndContext>
      </PanelIndexContainer>

      <ConfigModal
        isOpen={isNavConfigModalOpen}
        onClose={handleNavConfigModalClose}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            setEditingItem(contextMenu.item);
            setIsItemModalOpen(true);
          }}
          onDelete={handleContextDelete}
        />
      )}

      <EditWebsiteItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        item={editingItem}
        onSave={handleSaveItem}
        groups={groups}
        targetGroupUuid={targetGroupUuid}
      />
      <SearchEngineManagementModal
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
        engines={allSearchEngines}
        activeEngine={activeSearchEngine}
        onEngineChange={handleActiveEngineChange}
        onEnginesUpdate={loadSearchEngines}
      />
    </>
  );
};

const PanelPage: React.FC = () => {
  return (
    <IconRefreshProvider>
      <PanelSettingsProvider>
        <PanelPageContent />
      </PanelSettingsProvider>
    </IconRefreshProvider>
  );
};

export default PanelPage;
