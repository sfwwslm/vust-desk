import styled from "styled-components";
import { Theme } from "@/styles/themes";

// --- Main Layout ---
export const DashboardContainer = styled.main<{ theme: Theme }>`
  padding: 1.5rem 2rem;
  max-width: 88rem;
  margin: 0 auto;
  background-color: ${(props) => props.theme.colors.background};
  color: ${(props) => props.theme.colors.textPrimary};
  /* 让容器成为 flex 纵向布局，并撑满最小高度 */
  display: flex;
  flex-direction: column;
  min-height: 100%;
`;

// --- Summary Section ---
export const SummarySection = styled.div<{ theme: Theme }>`
  background-color: ${(props) => props.theme.colors.surface};
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: 0.75rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  text-align: center;
  font-size: 0.95rem;
  color: ${(props) => props.theme.colors.textSecondary};
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -2px rgba(0, 0, 0, 0.05);
  flex-shrink: 0; /* 防止摘要区域被压缩 */

  strong {
    color: ${(props) => props.theme.colors.primary};
    font-weight: 600;
    margin: 0 0.5rem;
  }
`;

// --- Table Section ---
export const TableSection = styled.section<{ theme: Theme }>`
  background-color: ${(props) => props.theme.colors.surface};
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -2px rgba(0, 0, 0, 0.05);
  padding: 1.5rem;
  /* 纵向 flex 布局，并占据所有剩余空间 */
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

export const TableHeader = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-shrink: 0; /* 防止表头被压缩 */

  @media (min-width: 640px) {
    flex-direction: row;
  }
`;

export const TableTitle = styled.h3<{ theme: Theme }>`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${(props) => props.theme.colors.textPrimary};
`;

export const TableActionsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;

  @media (min-width: 640px) {
    width: auto;
  }
`;

export const SearchInput = styled.input<{ theme: Theme }>`
  width: 100%;
  padding: 0.5rem 1rem;
  border: 1px solid ${(props) => props.theme.colors.border};
  background-color: ${(props) => props.theme.colors.background};
  color: ${(props) => props.theme.colors.textPrimary};
  border-radius: 0.5rem;
  outline: none;
  transition: all 0.2s ease;

  &:focus {
    box-shadow: 0 0 0 2px ${(props) => props.theme.colors.primaryFocus};
    border-color: ${(props) => props.theme.colors.primary};
  }

  @media (min-width: 640px) {
    width: 16rem;
  }
`;

export const TableWrapper = styled.div<{ theme: Theme }>`
  overflow-y: auto; /* 内容超出时出现滚动条 */
  border-radius: 0.5rem;
  border: 1px solid ${(props) => props.theme.colors.border};
  /* 占据父元素（TableSection）的所有剩余空间 */
  flex-grow: 1;
  display: flex; /* 让内部元素（table 或提示信息）可以撑满 */
  flex-direction: column;
`;

export const StyledTable = styled.table`
  width: 100%;
  font-size: 0.875rem;
  text-align: left;
  color: ${(props) => props.theme.colors.textSecondary};

  /* 当有数据时，表格高度自适应 */
  tbody tr {
    display: table-row;
  }
`;

export const TableHeaderCell = styled.th<{ theme: Theme }>`
  padding: 0.75rem 1.5rem;
  background-color: ${(props) =>
    props.theme.colors.border};
  color: ${(props) => props.theme.colors.textPrimary};
  text-transform: uppercase;
  cursor: pointer;
  transition: background-color 0.2s ease;
  white-space: nowrap;
  user-select: none;
  border-bottom: 1px solid ${(props) => props.theme.colors.border};
  position: sticky; /* 让表头在滚动时固定 */
  top: 0;
  z-index: ${(props) => props.theme.zIndices.sticky};;
  text-align: center;

  &:first-child {
    border-top-left-radius: 0.5rem;
  }
  &:last-child {
    border-top-right-radius: 0.5rem;
  }

  &:hover {
    filter: brightness(0.95);
  }

  &[data-sort-active="true"] {
    color: ${(props) => props.theme.colors.primary};
  }

  /* 确保 Tooltip 的包装器填满整个单元格 */
  .tooltip-wrapper {
    display: block;
    width: 100%;
  }
`;

export const TableBody = styled.tbody``;

export const TableRow = styled.tr<{ theme: Theme }>`
  background-color: ${(props) => props.theme.colors.surface};
  border-bottom: 1px solid ${(props) => props.theme.colors.border};
  transition: background-color 0.2s ease;

  &:last-child {
    border-bottom: none; /* 移除最后一行底部的边框 */
  }

  /* 添加斑马条纹效果 */
  &:nth-child(even) {
    background-color: ${(props) => props.theme.colors.background};
  }

  &:hover {
    background-color: ${(props) => props.theme.colors.primaryFocus};
  }
`;

export const TableCell = styled.td`
  padding: 1rem 1.5rem;
  white-space: nowrap;
  color: ${(props) => props.theme.colors.textPrimary};
  text-align: center;
`;

export const ActionButton = styled.button<{ theme: Theme }>`
  padding: 0.5rem 1rem;
  font-weight: 600;
  border-radius: 0.5rem;
  color: white;
  background-color: ${(props) => props.theme.colors.primary};
  transition: background-color 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;

  &:hover {
    filter: brightness(1.1);
  }
`;

export const TableActionButton = styled.button`
  font-weight: 500;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;

  &:hover {
    background-color: ${(props) => props.theme.colors.border};
  }
`;

export const EditButton = styled(TableActionButton)<{ theme: Theme }>`
  color: ${(props) => props.theme.colors.primary};
`;

export const DeleteButton = styled(TableActionButton)<{ theme: Theme }>`
  color: ${(props) => props.theme.colors.error};
`;

export const ActionCell = styled(TableCell)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center; 
`;

export const NoResultsMessage = styled.div<{ theme: Theme }>`
  text-align: center;
  color: ${(props) => props.theme.colors.textSecondary};
  /* 在 flex 容器中自动撑满并居中内容 */
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

export const LoadMoreContainer = styled.div`
  text-align: center;
  margin-top: 1.5rem;
  flex-shrink: 0; /* 防止加载更多按钮被压缩 */
`;
