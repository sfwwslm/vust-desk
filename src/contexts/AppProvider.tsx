import { AppThemeProvider } from "./ThemeContext";
import { EnvironmentProvider } from "./EnvironmentContext";
import { ModalProvider } from "./ModalContext";
import { AuthProvider } from "./AuthContext";
import { SyncProvider } from "./SyncContext";
import { ReactNode } from "react";

export const AppProvider = ({ children }: { children: ReactNode }) => (
  <AppThemeProvider>
    <AuthProvider>
      {/* 包裹在内层，以便 ModalProvider 可以访问认证状态 */}
      <EnvironmentProvider>
          {/* SyncProvider 包裹所有内容，以便可以全局显示遮罩 */}
          <SyncProvider>
        <ModalProvider>

            {children}

        </ModalProvider>
            </SyncProvider>
      </EnvironmentProvider>
    </AuthProvider>
  </AppThemeProvider>
);

 