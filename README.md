# ![logo](./src-tauri/icons/32x32.png) 桌面助手 (Vust Desk)

**Vust Desk** 是一款使用 [Tauri](https://tauri.app/) 和 [React](https://react.dev/) 构建的现代化的桌面应用，提供流畅、美观且高效的用户体验

## ✨ 主要功能

- **🌐 自定义导航面板**:
  - **分组管理**：自由创建、编辑、删除和排序网站分组
  - **网站项管理**：轻松添加、编辑、删除和排序网站链接
  - **自动元数据获取**：一键抓取网站的标题和图标 (Favicon)
  - **内外网 URL 支持**：为网站项分别设置公网和内网地址，并可一键切换
  - **拖拽排序**：支持对网站分组和组内网站项进行拖拽排序
  - **书签导入**：支持从浏览器导出的标准 HTML 书签文件导入数据
  - **动态图标**：支持 [Iconify](https://icon-sets.iconify.design/) 图标库，并优先使用本地缓存的网站图标

---

- **💼 资产管理**:
  - **资产清单**：统一管理您的实体或数字资产
  - **分类管理**：自定义资产分类，支持增、删、改、查
  - **数据统计**：自动计算资产总数和总价值
  - **灵活排序与搜索**：支持按名称、分类、价格、购买日期等字段排序和搜索

---

- **👤 用户与同步系统**:
  - **多账户管理**：支持登录多个账户并在本地进行切换
  - **匿名模式**：未登录时，数据将以匿名用户身份保存在本地
  - **数据认领**：登录后，可一键将本地的匿名数据所有权转移至当前账户
  - **双向数据同步**：与远端服务器进行安全、高效的数据双向同步，确保多端数据一致

---

- **⚙️ 高度可定制化设置**:
  - **多语言支持**：内置中文和英文，并可轻松切换
  - **主题切换**：支持明亮与黑暗两种主题模式
  - **启动项管理**：可设置是否开机自启以及是否启动时最小化到托盘
  - **窗口行为**：可配置关闭窗口时是直接退出还是最小化到系统托盘

---

## 🚀 技术栈

- **核心框架**: [Tauri (v2)](https://tauri.app/)
- **前端**: [React (v19)](https://react.dev/)，[TypeScript](https://www.typescriptlang.org/)
- **路由**: [@generouted/react-router](https://github.com/generouted/generouted)
- **状态管理**: React Context
- **UI/样式**: [Styled Components](https://styled-components.com/), [Framer Motion](https://www.framer.com/motion/)
- **本地数据库**: [tauri-plugin-sql](https://github.com/tauri-apps/tauri-plugin-sql/tree/v2) (使用 SQLite)
- **国际化 (i18n)**: [i18next](https://www.i18next.com/)，[react-i18next](https://react-i18next.com/)
- **打包与构建**: [Vite](https://vitejs.dev/)

## 🚀 快速开始

在开始之前，请确保您已经安装了 [Node.js](https://nodejs.org/)、[Rust](https://www.rust-lang.org/) 并根据 [Tauri 官方文档](https://v2.tauri.app/) 配置好您的开发环境

1. **克隆仓库**

    ```bash
    git clone https://github.com/sfwwslm/vust-desk.git
    cd vust-desk
    ```

2. **安装依赖**

    ```bash
    pnpm i
    ```

3. **启动开发环境**

    ```bash
    pnpm td
    ```

4. **构建应用**

    ```bash
    pnpm tb
    ```

    构建完成后，安装包会生成在 `src-tauri/target/release/bundle/` 目录下

## ⚙️ 配置文件

- **配置文件**: `~/.vust/config.json` - 存储如语言偏好等用户设置
- **数据库文件**: `~/.vust/data/` - 存放应用的`SQLite`数据库文件
- **图标缓存**: `~/.vust/icons/` - 存放自动抓取的网站图标缓存文件
