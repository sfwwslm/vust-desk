import { GlobalStyle } from "@/styles/GlobalStyles";
import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Menus from "@/components/layout/Menus";
import WindowControls from "@/components/layout/WindowControls";
import { debug, attachConsole } from "@tauri-apps/plugin-log";
import styled from "styled-components";
import { AppProvider } from "@/contexts/AppProvider";
import AppEventManager from "@/components/layout/AppEventManager";
import { useAuth } from "@/contexts/AuthContext";
import { getAllUsers, ANONYMOUS_USER_UUID } from "@/services/user";
import UserIcon from "@/components/layout/UserIcon";
import { useDisableBrowserShortcuts } from "@/hooks/useDisableBrowserShortcuts";
import { useMacAppMenu } from "@/hooks/useMacAppMenu";

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh; /* 确保占据整个视口高度 */
`;

const AppHeader = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  height: ${(props) => props.theme.sizing.appHeaderHeight};
  background-color: ${(props) => props.theme.colors.background};
  color: ${(props) => props.theme.colors.textPrimary};
  user-select: none;
  z-index: ${(props) => props.theme.zIndices.appHeader};
`;

const HeaderLeft = styled.div`
  height: 100%;
  margin-left: ${(props) => props.theme.spacing.headerMargin};
  font-size: ${(props) => props.theme.typography.menuFontSize};
`;

const HeaderRight = styled.div`
  height: 100%;
  margin-right: ${(props) => props.theme.spacing.headerMargin};
  // 使用 flex 布局来横向排列内部组件
  display: flex;
  align-items: center;
  gap: 5px; /* 在用户组件和窗口控制按钮之间添加一些间距 */
`;

const AppMain = styled.main`
  background-color: ${(props) => props.theme.colors.background};
  flex: 1;
  overflow: auto;
  margin: 0;
  min-height: 0; /* 允许内部可滚动区域占满空间而不撑开容器 */
`;

const AppLayout: React.FC = () => {
  const location = useLocation();
  const { activeUser, switchActiveUser } = useAuth();
  const isMacOS =
    typeof navigator !== "undefined" &&
    (navigator.platform.toLowerCase().includes("mac") ||
      navigator.userAgent.toLowerCase().includes("mac"));

  useDisableBrowserShortcuts();
  useMacAppMenu();

  useEffect(() => {
    debug(`路由切换到：${location.pathname}`);
  }, [location]);

  /**
   * @effect
   * @description 启动时验证当前活动用户是否有效
   */
  useEffect(() => {
    const validateActiveUser = async () => {
      // 如果当前没有活动用户，或活动用户已经是匿名用户，则无需验证
      if (!activeUser || activeUser.uuid === ANONYMOUS_USER_UUID) {
        return;
      }

      const allDbUsers = await getAllUsers();
      const activeUserExistsInDb = allDbUsers.some(
        (user) => user.uuid === activeUser.uuid,
      );

      // 如果活动用户在数据库中不存在，则切换回匿名用户
      if (!activeUserExistsInDb) {
        debug(
          `活动用户 "${activeUser.username}" 在数据库中不存在，已自动切换回匿名用户。`,
        );
        const anonymousUser = allDbUsers.find(
          (u) => u.uuid === ANONYMOUS_USER_UUID,
        );
        if (anonymousUser) {
          switchActiveUser(anonymousUser);
        }
      }
    };

    validateActiveUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组确保只在启动时运行一次

  useEffect(() => {
    if (import.meta.env.DEV) {
      attachConsole();
    }
  }, []);

  return (
    <AppContainer className="app-container">
      {!isMacOS && (
        <AppHeader className="app-header" data-tauri-drag-region>
          <HeaderLeft className="header-left" data-tauri-drag-region="false">
            <Menus />
          </HeaderLeft>
          <HeaderRight className="header-right" data-tauri-drag-region="false">
            <UserIcon />
            <div className="window-controls-wrapper" style={{ height: "100%" }}>
              <WindowControls />
            </div>
          </HeaderRight>
        </AppHeader>
      )}
      <AppMain className="app-main">
        <Outlet />
      </AppMain>
    </AppContainer>
  );
};

export default function App() {
  return (
    <AppProvider>
      <GlobalStyle />
      {/* 在这里调用事件管理器，它会在整个应用生命周期中存在 */}
      <AppEventManager />
      <AppLayout />
    </AppProvider>
  );
}
