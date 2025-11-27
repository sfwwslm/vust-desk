import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
} from "react";
import SyncOverlay from "@/components/common/SyncOverlay/SyncOverlay";
import { useTranslation } from "react-i18next";

interface SyncContextType {
  isSyncing: boolean;
  syncMessage: string;
  syncCompleted: boolean; // 标记同步流程是否完成
  setIsSyncing: (isSyncing: boolean) => void;
  setSyncMessage: (message: string) => void;
  setSyncCompleted: (completed: boolean) => void;
  resetSyncState: () => void; // 用于重置状态
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(t("sync.preparingSync"));
  const [syncCompleted, setSyncCompleted] = useState(false);

  // 重置函数，在确认后调用
  const resetSyncState = useCallback(() => {
    setIsSyncing(false);
    setSyncCompleted(false);
    setSyncMessage(t("sync.preparingSync"));
  }, [t]);

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        syncMessage,
        syncCompleted,
        setIsSyncing,
        setSyncMessage,
        setSyncCompleted,
        resetSyncState,
      }}
    >
      {children}
      {/* 将 onConfirm 传递给 Overlay */}
      <SyncOverlay
        isOpen={isSyncing}
        text={syncMessage}
        completed={syncCompleted}
        onConfirm={resetSyncState}
      />
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
};
