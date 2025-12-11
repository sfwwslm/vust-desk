import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useModal } from "@/contexts/ModalContext";
import * as assetDb from "@/services/assetDb";
import { Asset } from "@/features/Assets/types";
import AssetForm from "@/features/Assets/AssetForm/AssetForm";
import Modal from "@/features/Assets/Modal/Modal";
import CategoryManagementModal from "@/features/Assets/CategoryManagement/CategoryManagementModal";
import { IoAdd, IoPencil, IoTrash, IoApps } from "react-icons/io5";
import { Theme } from "@/styles/themes";
import Tooltip from "@/components/common/Tooltip/Tooltip";
import {
  DashboardContainer,
  SummarySection,
  TableSection,
  TableHeader,
  TableTitle,
  TableActionsContainer,
  SearchInput,
  TableWrapper,
  StyledTable,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  ActionButton,
  EditButton,
  DeleteButton,
  ActionCell,
  NoResultsMessage,
  PaginationContainer,
  PageButton,
  PageInfo,
} from "./Dashboard.styles";
import { useAuth } from "@/contexts/AuthContext";
import * as log from "@tauri-apps/plugin-log";

const ITEMS_PER_PAGE = 10;

interface AssetDashboardProps {
  theme: Theme;
}

const AssetDashboard: React.FC<AssetDashboardProps> = ({ theme }) => {
  const { t } = useTranslation();
  const { openConfirm } = useModal();
  const { activeUser, isDataOperationInProgress, dataVersion } = useAuth();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Asset;
    order: "asc" | "desc";
  }>({ key: "purchase_date", order: "desc" });
  const [currentPage, setCurrentPage] = useState(1);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  /**
   * @function loadAssets
   * @description 从数据库加载资产数据。
   * @logic_comment
   * 此函数现在依赖于 `activeUser`。
   * 当 `useAuth` 上下文中的 `activeUser` 发生变化时（例如，用户切换），
   * `useCallback` 会重新创建一个新的 `loadAssets` 函数实例。
   */
  const loadAssets = useCallback(async () => {
    // 在加载数据前检查全局锁
    if (isDataOperationInProgress) {
      log.info(
        "一个数据密集型操作正在进行中，资产仪表盘已智能暂停本次数据加载以避免冲突。"
      );
      return; // 如果有操作正在进行，则直接返回，不执行任何数据库查询
    }

    // 确保 activeUser 存在，若不存在则不执行后续操作
    if (!activeUser?.uuid) {
      log.warn("loadAssets: 当前没有活跃用户，操作被中止。");
      // 可以选择清空列表或显示提示信息
      setAssets([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      log.info(
        `正在为用户 ${activeUser.username} (${activeUser.uuid}) 加载资产数据...`
      );
      const data = await assetDb.getAssetsData(activeUser.uuid);
      setAssets(data);
    } catch (error) {
      console.error("加载资产失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeUser, isDataOperationInProgress]);

  /**
   * @effect
   * @logic_comment
   * 这个 useEffect 依赖于 `loadAssets` 函数。
   * 由于 `loadAssets` 的依赖项中包含了 `activeUser`，
   * 因此每当 `activeUser` 改变，`loadAssets` 就会被重建，
   * 进而触发这个 useEffect 的重新执行，从而实现数据的自动刷新。
   * 这与导航页面的逻辑保持了一致。
   */
  useEffect(() => {
    loadAssets();
  }, [loadAssets, dataVersion]); // loadAssets dataVersion 作为依赖，当它改变时会强制重新加载数据

  const kpis = useMemo(() => {
    const totalValue = assets.reduce((sum, asset) => sum + asset.price, 0);
    const totalAssets = assets.length;
    return { totalValue, totalAssets };
  }, [assets]);

  const sortedAndFilteredAssets = useMemo(() => {
    let filtered = assets.filter(
      (asset) =>
        // 搜索过滤逻辑中包含的条件
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.brand?.toLocaleLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      const key = sortConfig.key;
      const order = sortConfig.order;
      const valA = key === "category_name" ? a.category_name : a[key];
      const valB = key === "category_name" ? b.category_name : b[key];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      let comparisonResult = 0;
      if (key === "purchase_date" || key === "expiration_date") {
        const dateA = new Date(valA as string).getTime();
        const dateB = new Date(valB as string).getTime();
        if (dateA < dateB) comparisonResult = -1;
        else if (dateA > dateB) comparisonResult = 1;
      } else {
        if (valA < valB) comparisonResult = -1;
        else if (valA > valB) comparisonResult = 1;
      }

      return order === "asc" ? comparisonResult : -comparisonResult;
    });
  }, [assets, searchTerm, sortConfig]);

  const handleSort = (key: keyof Asset | "category_name") => {
    setSortConfig((prev) => ({
      key: key as keyof Asset,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  useEffect(() => {
    // 搜索或数据变化时回到第一页，避免页码超出范围
    setCurrentPage(1);
  }, [searchTerm, assets.length]);

  useEffect(() => {
    // 当总页数变小且当前页超出时，自动回退到最后一页
    const total = Math.max(
      1,
      Math.ceil(sortedAndFilteredAssets.length / ITEMS_PER_PAGE)
    );
    if (currentPage > total) {
      setCurrentPage(total);
    }
  }, [sortedAndFilteredAssets.length, currentPage]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedAndFilteredAssets.length / ITEMS_PER_PAGE)
  );

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return sortedAndFilteredAssets.slice(start, end);
  }, [sortedAndFilteredAssets, currentPage]);

  const handleAdd = () => {
    setEditingAsset(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setIsFormModalOpen(true);
  };

  const handleDelete = (asset: Asset) => {
    openConfirm({
      title: t("management.asset.delTitle"),
      message: t("management.asset.deleteConfirmMessage", {
        assetName: asset.name,
      }),
      confirmText: t("button.delete"),
      cancelText: t("button.cancel"),
      onConfirm: async () => {
        await assetDb.deleteAsset(asset.uuid);
        loadAssets();
      },
    });
  };

  const handleSubmit = async (submittedAsset: Partial<Asset>) => {
    // 确保提交的资产数据关联到当前活跃用户
    submittedAsset.user_uuid = activeUser?.uuid;

    await assetDb.saveAsset(submittedAsset);
    setIsFormModalOpen(false);
    loadAssets();
  };

  const handleCategoryModalClose = (refreshNeeded?: boolean) => {
    setIsCategoryModalOpen(false);
    if (refreshNeeded) {
      loadAssets(); // 如果分类有变动，也重新加载资产数据
    }
  };

  return (
    <>
      <DashboardContainer theme={theme}>
        <SummarySection theme={theme} id="asset-summary">
          {t("management.asset.totalAssets")}:{" "}
          <strong>{kpis.totalAssets}</strong>
          <span style={{ margin: "0 1rem" }}>|</span>
          {t("management.asset.totalValue")}:
          <strong>
            ¥
            {kpis.totalValue.toLocaleString("zh-CN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </SummarySection>

        <TableSection theme={theme}>
          <TableHeader id="asset-header">
            <TableTitle theme={theme}>
              {t("management.asset.assetList")}
            </TableTitle>
            <TableActionsContainer>
              <SearchInput
                id="asset-search-input"
                theme={theme}
                type="text"
                placeholder={t("management.asset.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <ActionButton
                id="asset-category-button"
                onClick={() => setIsCategoryModalOpen(true)}
                theme={theme}
              >
                <IoApps size={20} />
                {t("management.asset.category.manage")}
              </ActionButton>
              <ActionButton
                id="asset-add-button"
                onClick={handleAdd}
                theme={theme}
              >
                <IoAdd size={20} />
                {t("management.asset.addAsset")}
              </ActionButton>
            </TableActionsContainer>
          </TableHeader>
          <TableWrapper theme={theme} id="asset-list">
            {sortedAndFilteredAssets.length > 0 ? (
              <StyledTable theme={theme}>
                <thead>
                  <tr id="asset-title">
                    <TableHeaderCell
                      theme={theme}
                      onClick={() => handleSort("name")}
                      data-sort-active={sortConfig.key === "name"}
                    >
                      <Tooltip text={t("common.sortTooltip")}>
                        <span>{t("management.asset.name")}</span>
                      </Tooltip>
                    </TableHeaderCell>
                    <TableHeaderCell
                      theme={theme}
                      onClick={() => handleSort("brand")}
                      data-sort-active={sortConfig.key === "brand"}
                    >
                      <Tooltip text={t("common.sortTooltip")}>
                        <span>{t("management.asset.brand")}</span>
                      </Tooltip>
                    </TableHeaderCell>
                    <TableHeaderCell
                      theme={theme}
                      onClick={() => handleSort("category_name")}
                      data-sort-active={sortConfig.key === "category_name"}
                    >
                      <Tooltip text={t("common.sortTooltip")}>
                        <span>{t("management.asset.category.category")}</span>
                      </Tooltip>
                    </TableHeaderCell>
                    <TableHeaderCell
                      theme={theme}
                      onClick={() => handleSort("price")}
                      data-sort-active={sortConfig.key === "price"}
                    >
                      <Tooltip text={t("common.sortTooltip")}>
                        <span>{t("common.price")}</span>
                      </Tooltip>
                    </TableHeaderCell>
                    <TableHeaderCell
                      theme={theme}
                      onClick={() => handleSort("purchase_date")}
                      data-sort-active={sortConfig.key === "purchase_date"}
                    >
                      <Tooltip text={t("common.sortTooltip")}>
                        <span>{t("common.purchaseDate")}</span>
                      </Tooltip>
                    </TableHeaderCell>
                    <TableHeaderCell theme={theme}>
                      {t("common.actions")}
                    </TableHeaderCell>
                  </tr>
                </thead>
                <TableBody>
                  {paginatedAssets.map((asset) => (
                    <TableRow
                      key={asset.uuid}
                      theme={theme}
                      className="asset-row"
                    >
                      <TableCell className="font-medium text-slate-900">
                        {asset.name}
                      </TableCell>
                      <TableCell className="text-slate-900">
                        {asset.brand || t("common.none")}
                      </TableCell>
                      <TableCell>
                        {asset.category_is_default === 1
                          ? t("management.asset.category.defaultCategory")
                          : asset.category_name || t("common.none")}
                      </TableCell>
                      <TableCell>￥ {asset.price.toLocaleString("zh-CN")}</TableCell>
                      <TableCell>{asset.purchase_date}</TableCell>
                      <ActionCell>
                        <Tooltip text={t("common.edit")}>
                          <EditButton
                            theme={theme}
                            onClick={() => handleEdit(asset)}
                          >
                            <IoPencil />
                          </EditButton>
                        </Tooltip>
                        <Tooltip text={t("common.delete")}>
                          <DeleteButton
                            theme={theme}
                            onClick={() => handleDelete(asset)}
                          >
                            <IoTrash />
                          </DeleteButton>
                        </Tooltip>
                      </ActionCell>
                    </TableRow>
                  ))}
                </TableBody>
              </StyledTable>
            ) : (
              !isLoading && (
                <NoResultsMessage theme={theme}>
                  <p className="text-lg">
                    {t("management.asset.noAssetsFound")}
                  </p>
                  <p className="text-sm">
                    {t("management.asset.noAssetsSuggestion")}
                  </p>
                </NoResultsMessage>
              )
            )}
          </TableWrapper>
          {sortedAndFilteredAssets.length > 0 && (
            <PaginationContainer>
              <PageButton
                theme={theme}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                {t("common.prevPage")}
              </PageButton>
              <PageInfo theme={theme}>
                {currentPage} / {totalPages}
              </PageInfo>
              <PageButton
                theme={theme}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
              >
                {t("common.nextPage")}
              </PageButton>
            </PaginationContainer>
          )}
        </TableSection>
      </DashboardContainer>

      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={
          editingAsset
            ? t("management.asset.editAsset")
            : t("management.asset.addAsset")
        }
      >
        <AssetForm initialData={editingAsset} onSubmit={handleSubmit} />
      </Modal>

      <CategoryManagementModal
        isOpen={isCategoryModalOpen}
        onClose={handleCategoryModalClose}
      />
    </>
  );
};

export default AssetDashboard;



