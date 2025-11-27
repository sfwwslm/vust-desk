import React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { useAuth } from "@/contexts/AuthContext";
import { ANONYMOUS_USER_UUID } from "@/services/user";
import CustomSelect, {
  SelectOption,
} from "@/components/common/CustomSelect/CustomSelect";
import { Label as BaseLabel } from "@/components/styled/StyledForm";
import { StyledButton } from "@/components/styled/StyledButton";
import DataClaim from "./DataClaim";
import LoginModal from "./LoginModal";
import { IoLogInOutline, IoSyncOutline } from "react-icons/io5";
import { useModal } from "@/contexts/ModalContext";
import { useSync } from "@/contexts/SyncContext";
import { startSync } from "@/services/sync";

const AuthContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 450px;
  margin: 0 auto;
`;

const SettingsBlock = styled.div`
  padding: 1.5rem;
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: ${(props) => props.theme.radii.base};
  background-color: ${(props) => props.theme.colors.background};
`;

const Label = styled(BaseLabel)`
  text-align: left;
  margin-bottom: 0.75rem;
  display: block;
`;

const UserSwitcherContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const AuthActionsContainer = styled(SettingsBlock)`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap; /* 允许在空间不足时换行 */
`;

const AuthSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    isLoggedIn,
    logout,
    activeUser,
    switchActiveUser,
    availableUsers,
    incrementDataVersion,
    refreshAvailableUsers,
  } = useAuth();
  const { openModal } = useModal();
  const { isSyncing, setIsSyncing, setSyncMessage, setSyncCompleted } =
    useSync(); // 从 context 获取状态和方法

  const handleUserSwitch = (uuid: string | number) => {
    const selectedUser = availableUsers.find((u) => u.uuid === uuid);
    if (selectedUser) {
      switchActiveUser(selectedUser);
    }
  };

  const handleSync = async () => {
    if (!activeUser || isSyncing) return;
    setSyncMessage(t("sync.preparingSync"));
    // 传入同步服务,调用同步服务，并传入UI更新函数
    await startSync(activeUser, {
      setIsSyncing,
      setSyncMessage,
      setSyncCompleted,
      incrementDataVersion,
      switchActiveUser,
      refreshAvailableUsers,
      t,
    });
  };

  // 在下拉选项中也显示UID
  const userOptions: SelectOption[] = availableUsers.map((user) => ({
    value: user.uuid,
    label: `${user.username} (uid: ${user.uuid.substring(0, 5)})`,
  }));

  return (
    <>
      <AuthContainer className="auth-settings-container">
        {/* 用户切换区块 */}
        <SettingsBlock className="user-switcher-block">
          <Label>{t("account.currentUser")}</Label>
          <UserSwitcherContainer>
            <div style={{ flexGrow: 1 }}>
              <CustomSelect
                options={userOptions}
                value={activeUser?.uuid}
                onChange={handleUserSwitch}
              />
            </div>
            {isLoggedIn && activeUser?.uuid !== ANONYMOUS_USER_UUID && (
              <StyledButton onClick={() => logout()} variant="danger">
                {t("account.logoutButton")}
              </StyledButton>
            )}
          </UserSwitcherContainer>
        </SettingsBlock>

        {/* 操作区块 */}
        <AuthActionsContainer>
          <StyledButton
            onClick={() =>
              openModal(
                (close) => <LoginModal isOpen={true} onClose={close} />,
                {
                  key: "login",
                }
              )
            }
            variant="primary"
          >
            <IoLogInOutline style={{ marginRight: "8px" }} />
            {t("account.title")}
          </StyledButton>

          {/* 数据认领和同步按钮 */}
          {isLoggedIn && activeUser?.uuid !== ANONYMOUS_USER_UUID && (
            <>
              <DataClaim />
              <StyledButton
                onClick={handleSync}
                disabled={isSyncing}
                variant="secondary"
                className="sync-data-button"
              >
                <IoSyncOutline style={{ marginRight: "8px" }} />
                {isSyncing ? t("account.syncing") : t("account.dataSync")}
              </StyledButton>
            </>
          )}
        </AuthActionsContainer>
      </AuthContainer>
    </>
  );
};

export default AuthSettings;
