# Helper 应用主题设计与重构指南

## 1. 简介

本指南旨在为 `helper` 应用建立一个健壮、可扩展且易于维护的主题（Theming）体系。遵循本指南将确保应用 UI 的视觉一致性，降低未来维护成本，并提升开发者体验。

当前的实现（位于 `src/styles/themes.ts`）已经为明暗主题打下了良好基础。本次重构的核心目标是引入 **设计令牌（Design Tokens）** 的分层思想，将样式决策从具体实现中解耦。

## 2. 核心原则

* **一致性 (Consistency):** 应用内所有组件的视觉表现（颜色、间距、字体等）都应源自统一的、预定义的设计决策。
* **可维护性 (Maintainability):** 当需要调整全局样式（例如，改变主色调或调整圆角大小）时，应只需修改一处或少数几处核心令牌，变更即可自动应用到整个应用。

## 3. 设计令牌体系 (The Token Hierarchy)

这是本次重构的核心。我们将当前的主题变量拆分为两个层次：**全局令牌** 和 **别名/语义化令牌**。

### 3.1. 全局令牌 (Global/Primitive Tokens)

这是设计的“调色板”，定义了所有最基础、与上下文无关的原始值。它们不应被组件直接使用。

**建议文件结构:**

```text
src/
└── styles/
    ├── tokens/
    │   ├── colors.ts
    │   ├── spacing.ts
    │   ├── typography.ts
    │   ├── shadows.ts
    │   └── zIndex.ts
    └── themes.ts
```

**示例 `src/styles/tokens/colors.ts`:**
(从你现有的 `themes.ts` 提取)

```typescript
// 定义了应用的基础色板
export const colorPalette = {
  cyan: {
    '400': '#62efff',
    '500': '#00bcd4', // 当前的主色
    '800': '#008ba3',
  },
  purple: {
    '500': '#673ab7', // 当前的次要色
    '600': '#9a67ea',
  },
  gray: {
    '100': '#f4f7f6',
    '200': '#e0e0e0',
    '300': '#dee2e6',
    '700': '#666666',
    '800': '#333333',
    '900': '#212529',
  },
  blueGray: {
    '700': '#2b3a5b',
    '800': '#162447',
    '900': '#1a1a2e',
  },
  white: '#ffffff',
  black: '#000000',
  red: {
    '500': '#f44336',
  },
  green: {
    '500': '#4caf50',
  },
  orange: {
    '500': '#ffc107',
  }
};
```

**示例 `src/styles/tokens/zIndex.ts`:**
(将你现有的 `zIndex` 对象移入独立文件，这是非常好的实践)

```typescript
// zIndex 的管理保持不变，结构已经很优秀
export const zIndices = {
  sticky: 1,
  base: 10,
  dropdown: 1200,
  appHeader: 9999,
  modalBackdrop: 990,
  modal: 1000,
  contextMenu: 1010,
  tooltip: 1001,
  loadingOverlay: 1100,
  notification: 1002,
  userCard: 1200,
  loginModal: 1000,
};
```

### 3.2. 别名/语义化令牌 (Alias/Semantic Tokens)

这是你的 `lightTheme` 和 `darkTheme` 对象，它们的作用是给全局令牌赋予具体的、有意义的名称。**组件应该总是使用这些语义化的令牌**。

**重构后的 `src/styles/themes.ts`:**

```typescript
import { colorPalette } from './tokens/colors';
import { zIndices } from './tokens/zIndex';
// 导入其他全局令牌...

export const lightTheme = {
  // 通用字体等保持不变
  fontFamily: '"Microsoft YaHei", Inter, Avenir, Helvetica, Arial, sans-serif',
  fontSizeBase: "14px",

  zIndex: zIndices, // 直接引用

  // --- 语义化颜色 ---
  colors: {
    primary: colorPalette.cyan[500],
    primaryDark: colorPalette.cyan[800],
    primaryLight: colorPalette.cyan[400],
    secondary: colorPalette.purple[500],
    
    background: colorPalette.gray[100],
    surface: colorPalette.white, // 卡片、模态框等表面颜色
    
    textPrimary: colorPalette.gray[900],
    textSecondary: colorPalette.gray[700],
    textOnPrimary: colorPalette.white, // 在主色上方的文本颜色
    
    border: colorPalette.gray[200],
    
    success: colorPalette.green[500],
    error: colorPalette.red[500],
    warning: colorPalette.orange[500],
  },

  // --- 语义化阴影 ---
  shadows: {
    interactive: '0 5px 15px rgba(0, 188, 212, 0.4)',
    card: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
  },
  
  // ... 其他语义化令牌
};

export const darkTheme = {
  // ...
  zIndex: zIndices,
  
  colors: {
    primary: colorPalette.cyan[500],
    secondary: colorPalette.purple[500],

    background: colorPalette.blueGray[900],
    surface: colorPalette.blueGray[800], // Dark-mode 卡片背景

    textPrimary: colorPalette.gray[100],
    textSecondary: colorPalette.gray[300],
    textOnPrimary: colorPalette.white,

    border: colorPalette.blueGray[700],
    // ...
  },
  // ...
};

export type Theme = typeof lightTheme;
```

## 4. 详细设计指南

### 4.1. 结构化主题对象

建议的主题结构应包含以下类别：

* `colors`: 语义化颜色
* `typography`: 字体家族、字号、字重、行高等
* `spacing`: 统一的间距基准单位及其倍数
* `sizing`: 常用组件尺寸（如按钮高度、输入框高度）
* `radii`: 边框圆角值
* `shadows`: 语义化阴影效果
* `zIndices`: 层级管理
* `breakpoints`: 响应式断点

### 4.2. 消除“魔法数字”

检查代码库中所有硬编码的像素值（“魔法数字”），并将其令牌化。

**示例：重构 `AssetDashboard.styles.ts`**

**修改前:**

```typescript
export const DashboardContainer = styled.main<{ theme: Theme }>`
  padding: 1.5rem 2rem;
  max-width: 88rem; // <-- 魔法数字
  // ...
`;
```

**修改后:**

1. 在主题中添加 `breakpoints` 或 `sizing`：

    ```typescript
    // in themes.ts
    export const lightTheme = {
      // ...
      sizing: {
        contentMaxWidth: '88rem',
      }
    };
    ```

2. 在组件样式中使用令牌：

    ```typescript
    // in AssetDashboard.styles.ts
    export const DashboardContainer = styled.main<{ theme: Theme }>`
      padding: 1.5rem 2rem;
      max-width: ${(props) => props.theme.sizing.contentMaxWidth};
      // ...
    `;
    ```

### 4.3. 组件样式

组件应始终使用**语义化令牌**。

**示例：重构 `StyledButton`**

**修改前:**

```typescript
export const StyledButton = styled(motion.button)`
  // ...
  box-shadow: 0 5px 15px
    ${(props) => props.theme.primaryColorTransparentFocus};
`;
```

**修改后:** (假设已在 `themes.ts` 中定义了 `shadows.interactive`)

```typescript
export const StyledButton = styled(motion.button)`
  // ...
  &:hover {
    box-shadow: ${(props) => props.theme.shadows.interactive};
  }
`;
```

## 5. 建议重构步骤

当决定开始重构时，可以遵循以下步骤，以确保过程平稳：

1. **创建新的文件结构：** 在 `src/styles/` 下创建 `tokens` 目录，并建立 `colors.ts`, `zIndex.ts` 等文件。
2. **填充全局令牌：** 仔细审查 `src/styles/themes.ts`，将所有原始值（如 hex 颜色码、像素值）提取到相应的 `tokens` 文件中。
3. **重构 `themes.ts`：** 修改 `lightTheme` 和 `darkTheme`，让它们引用 `tokens` 文件中的全局令牌来构建语义化令牌。
4. **增量更新组件：** 逐个文件审查 `*.styles.ts`。将组件中使用的旧主题变量（如 `theme.primaryColor`）替换为新的、更语义化的令牌（如 `theme.colors.primary`）。
5. **令牌化魔法数字：** 查找并替换硬编码的布局值（如 `max-width`, `border-radius`），将它们移入主题对象中。
6. **代码审查：** 完成后，对所有变更进行一次全面的代码审查，确保所有样式都源自新的主题体系。
