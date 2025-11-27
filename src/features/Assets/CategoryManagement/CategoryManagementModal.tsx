import React, { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { IoPencil, IoTrash } from "react-icons/io5";

import { useModal } from "@/contexts/ModalContext";
import * as assetDb from "@/services/assetDb";
import { AssetCategory } from "@/features/Assets/types";
import Modal from "@/features/Assets/Modal/Modal";
import { Input } from "@/components/styled/StyledForm";
import { StyledButton } from "@/components/styled/StyledButton";
import Loading from "@/components/common/Loading";
import Tooltip from "@/components/common/Tooltip/Tooltip";
import { useAuth } from "@/contexts/AuthContext";

const CategoryList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem 0; /* 增加底部边距 */
  max-height: 40vh;
  overflow-y: auto;

  /* 美化滚动条 */
  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: ${(props) => props.theme.colors.background};
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${(props) => props.theme.colors.border};
    border-radius: 8px;
    &:hover {
      background: ${(props) => props.theme.colors.primary};
    }
  }
`;

const CategoryListItem = styled(motion.li)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: ${(props) => props.theme.colors.background};
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: ${(props) => props.theme.radii.base};
  margin-bottom: 0.5rem;
  transition: background-color 0.2s, border-color 0.2s;

  &:hover {
    background-color: ${(props) => props.theme.colors.background};
    border-color: ${(props) => props.theme.colors.primary};
  }
`;

const CategoryName = styled.span`
  font-weight: 500;
  color: ${(props) => props.theme.colors.textPrimary};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  font-size: 1.1rem;
  padding: 0.25rem;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &.edit-btn {
    color: ${(props) => props.theme.colors.primary};
    &:hover:not(:disabled) {
      background-color: ${(props) => props.theme.colors.border};
    }
  }

  &.delete-btn {
    color: ${(props) => props.theme.colors.error};
    &:hover:not(:disabled) {
      background-color: ${(props) => props.theme.colors.border};
    }
  }

  &:disabled {
    color: ${(props) => props.theme.colors.border};
    cursor: not-allowed;
  }
`;

const FormContainer = styled.form`
  display: flex;
  gap: 0.75rem;
  align-items: center;

  .category-input {
    flex-grow: 1;
  }
`;

/**
 * @component CompactPrimaryButton
 * @description 继承自 StyledButton，但尺寸更紧凑，与 ghost 按钮保持一致。
 */
const CompactPrimaryButton = styled(StyledButton)`
  padding: 6px 12px;
  font-size: 0.8rem;
  flex-shrink: 0;
`;

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: (refreshNeeded?: boolean) => void;
}

const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { openConfirm, openAlert } = useModal();
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(
    null
  );
  const [refreshNeeded, setRefreshNeeded] = useState(false);
  const { activeUser } = useAuth();

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!activeUser?.uuid) return;
      const data = await assetDb.getAllCategories(activeUser.uuid);
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeUser]);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen, loadCategories]);

  const handleClose = () => {
    onClose(refreshNeeded);
    setInputValue("");
    setEditingCategory(null);
    setRefreshNeeded(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const isDuplicate = categories.some(
      (cat) =>
        cat.name.toLowerCase() === inputValue.trim().toLowerCase() &&
        cat.uuid !== editingCategory?.uuid
    );

    if (isDuplicate) {
      openAlert({
        title: t("management.asset.category.errorDuplicateTitle"),
        message: t("management.asset.category.errorDuplicateMessage"),
      });
      return;
    }

    try {
      await assetDb.saveCategory({
        uuid: editingCategory?.uuid,
        name: inputValue.trim(),
        user_uuid: activeUser?.uuid,
      });
      setRefreshNeeded(true);
      await loadCategories();
      setInputValue("");
      setEditingCategory(null);
    } catch (error) {
      console.error("Failed to save category:", error);
    }
  };

  const handleEdit = (category: AssetCategory) => {
    setEditingCategory(category);
    setInputValue(category.name);
  };

  const handleDelete = (category: AssetCategory) => {
    // 理论上按钮已禁用，但作为双重保险
    if (category.is_default === 1) {
      openAlert({
        title: "操作无效",
        message: "不能删除默认分类。",
      });
      return;
    }
    openConfirm({
      title: t("management.asset.category.deleteTitle"),
      message: t("management.asset.category.deleteMessage", {
        categoryName: category.name,
      }),
      onConfirm: async () => {
        try {
          await assetDb.deleteCategory(category.uuid);
          setRefreshNeeded(true);
          await loadCategories();
        } catch (error: any) {
          openAlert({
            title: t("management.asset.category.deleteErrorTitle"),
            message:
              error.message ||
              "An unexpected error occurred while deleting the category.",
          });
          console.error("Failed to delete category:", error);
        }
      },
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("management.asset.category.title")}
    >
      {isLoading ? (
        <Loading />
      ) : (
        <>
          <CategoryList>
            <AnimatePresence>
              {categories.map((cat) => {
                // 通过 cat.is_default 标志判断
                const isDefaultCategory = cat.is_default === 1;
                return (
                  <CategoryListItem
                    key={cat.uuid}
                    layout
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="category-list-item"
                  >
                    <CategoryName>
                      {isDefaultCategory
                        ? t("management.asset.category.defaultCategory")
                        : cat.name}
                    </CategoryName>
                    <ActionButtons>
                      <Tooltip
                        text={
                          isDefaultCategory
                            ? t(
                                "management.asset.category.defaultCategoryTooltip"
                              )
                            : t("common.edit")
                        }
                      >
                        <ActionButton
                          className="edit-btn"
                          onClick={() => handleEdit(cat)}
                          aria-label={t("common.edit")}
                          disabled={isDefaultCategory}
                        >
                          <IoPencil />
                        </ActionButton>
                      </Tooltip>
                      <Tooltip
                        text={
                          isDefaultCategory
                            ? t(
                                "management.asset.category.defaultCategoryTooltip"
                              )
                            : t("common.delete")
                        }
                      >
                        <ActionButton
                          className="delete-btn"
                          onClick={() => handleDelete(cat)}
                          aria-label={t("common.delete")}
                          disabled={isDefaultCategory}
                        >
                          <IoTrash />
                        </ActionButton>
                      </Tooltip>
                    </ActionButtons>
                  </CategoryListItem>
                );
              })}
            </AnimatePresence>
          </CategoryList>

          <FormContainer onSubmit={handleSubmit}>
            <Input
              type="text"
              className="category-input"
              placeholder={
                editingCategory
                  ? t("management.asset.category.editingPlaceholder")
                  : t("management.asset.category.addPlaceholder")
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />

            <CompactPrimaryButton variant="primary" type="submit">
              {editingCategory
                ? t("common.save")
                : t("management.asset.category.add")}
            </CompactPrimaryButton>

            {editingCategory && (
              <StyledButton
                variant="ghost"
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setInputValue("");
                }}
                style={{ flexShrink: 0 }}
              >
                {t("button.cancel")}
              </StyledButton>
            )}
          </FormContainer>
        </>
      )}
    </Modal>
  );
};

export default CategoryManagementModal;
