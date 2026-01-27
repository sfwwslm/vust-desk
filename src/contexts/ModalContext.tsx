import {
  createContext,
  useState,
  useCallback,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { useLocation } from "react-router-dom";
import AlertModal, {
  AlertModalProps,
} from "@/components/common/AlertModal/AlertModal";
import ConfirmationModal, {
  ConfirmationModalProps,
} from "@/components/common//ConfirmationModal/ConfirmationModal";

interface ModalState {
  id: string;
  content: ReactNode;
  zIndex?: number;
  key?: string; // 为每个模态框状态添加一个可选的 key
}

// 定义 openModal 的类型
interface ModalOptions {
  zIndex?: number;
  key?: string;
}

interface ModalContextType {
  openModal: (
    renderContent: (close: () => void) => ReactNode,
    options?: ModalOptions,
  ) => void;
  closeModal: (id?: string) => void;
  openAlert: (props: Omit<AlertModalProps, "isOpen" | "onClose">) => void;
  openConfirm: (
    props: Omit<ConfirmationModalProps, "isOpen" | "onClose" | "onCancel"> & {
      onCancel?: () => void;
      modalKey?: string;
    },
  ) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [modals, setModals] = useState<ModalState[]>([]);
  const location = useLocation();

  const closeModal = useCallback((id?: string) => {
    setModals((prevModals) => {
      if (id) {
        return prevModals.filter((modal) => modal.id !== id);
      }
      return prevModals.slice(0, -1);
    });
  }, []);

  const openModal = useCallback(
    (
      renderContent: (close: () => void) => ReactNode,
      options?: ModalOptions,
    ) => {
      const { key, zIndex } = options || {};

      setModals((prevModals) => {
        // 在更新函数内部检查重复
        if (key) {
          const existingModal = prevModals.find((m) => m.key === key);
          if (existingModal) {
            const close = () => closeModal(existingModal.id);
            const content = renderContent(close);
            return prevModals.map((modal) =>
              modal.key === key
                ? { ...modal, content, zIndex: zIndex ?? modal.zIndex }
                : modal,
            );
          }
        }

        const modalId = `modal-${Date.now()}-${Math.random()}`;
        const close = () => closeModal(modalId);
        const content = renderContent(close);

        const newModal: ModalState = {
          id: modalId,
          content,
          zIndex,
          key,
        };

        return [...prevModals, newModal]; // 返回新状态
      });
    },
    [closeModal],
  );

  const openAlert = useCallback(
    (props: Omit<AlertModalProps, "isOpen" | "onClose">) => {
      openModal((close) => (
        <AlertModal {...props} isOpen={true} onClose={close} />
      ));
    },
    [openModal],
  );

  const openConfirm = useCallback(
    (
      props: Omit<ConfirmationModalProps, "isOpen" | "onClose" | "onCancel"> & {
        onCancel?: () => void;
        modalKey?: string;
      },
    ) => {
      const { modalKey, ...rest } = props;
      openModal(
        (close) => {
          const handleConfirm = () => {
            rest.onConfirm();
            close();
          };
          const handleCancel = () => {
            rest.onCancel?.();
            close();
          };
          return (
            <ConfirmationModal
              {...rest}
              isOpen={true}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          );
        },
        modalKey ? { key: modalKey } : undefined,
      );
    },
    [openModal],
  );

  useEffect(() => {
    // 路由切换时，直接无条件清空所有模态框
    setModals([]);
  }, [location.pathname]);

  return (
    <ModalContext.Provider
      value={{ openModal, closeModal, openAlert, openConfirm }}
    >
      {children}
      {modals.map((modal) => (
        <div key={modal.id}>{modal.content}</div>
      ))}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal 必须在 ModalProvider 内部使用");
  }
  return context;
};
