import { createContext, useContext, ReactNode } from "react";
import useLocalStorage from "@/hooks/useLocalStorage";

/**
 * @interface PanelSettingsContextType
 * @description 定义了面板个性化设置 Context 的数据结构。
 *
 * @property {number} sideMargin - 内容区域两侧的边距百分比。
 * - 这个值会同步到 localStorage，实现持久化。
 * - 它也被用来设置 CSS 变量，以实现高效的实时样式更新。
 * @property {(margin: number) => void} setSideMargin - 更新边距值的函数。
 * - 调用此函数会同时更新 Context 状态和 localStorage 中的值。
 */
interface PanelSettingsContextType {
  sideMargin: number;
  setSideMargin: (margin: number) => void;
}

/**
 * @const PanelSettingsContext
 * @description React Context 对象，用于在组件树中传递面板的个性化设置。
 */
const PanelSettingsContext = createContext<
  PanelSettingsContextType | undefined
>(undefined);

/**
 * @component PanelSettingsProvider
 * @description Context 的提供者组件。
 *
 * @logic
 * - 使用 `useLocalStorage` 自定义 Hook 来创建 `sideMargin` 状态。
 * 这确保了设置值能够在浏览器会话之间持久存在。
 * - 将 `sideMargin` 的值和其更新函数 `setSideMargin` 通过 Context Provider 提供给其所有子组件。
 * - 任何被 `<PanelSettingsProvider>` 包裹的组件都可以通过 `usePanelSettings` Hook 访问到这些共享状态。
 *
 * @param {{ children: ReactNode }} props - 接收子组件。
 */
export const PanelSettingsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [sideMargin, setSideMargin] = useLocalStorage<number>(
    "panelContentSideMargin",
    5 // 默认值为 5%
  );

  return (
    <PanelSettingsContext.Provider value={{ sideMargin, setSideMargin }}>
      {children}
    </PanelSettingsContext.Provider>
  );
};

/**
 * @hook usePanelSettings
 * @description 一个自定义 Hook，简化了对 PanelSettingsContext 的访问。
 *
 * @logic
 * - 内部调用 `useContext` 来获取 Context 的值。
 * - 增加了一个重要的检查：如果组件没有被包裹在 `PanelSettingsProvider` 内部，
 * `useContext` 会返回 `undefined`。此时，我们会抛出一个明确的错误，
 * 这可以帮助开发者快速定位问题，而不是让应用在后续操作中静默失败。
 *
 * @returns {PanelSettingsContextType} 返回包含 `sideMargin` 和 `setSideMargin` 的 Context 对象。
 */
export const usePanelSettings = () => {
  const context = useContext(PanelSettingsContext);
  if (context === undefined) {
    throw new Error(
      "usePanelSettings must be used within a PanelSettingsProvider"
    );
  }
  return context;
};
