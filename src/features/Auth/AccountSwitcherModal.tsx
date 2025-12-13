import React from "react";
import { useTranslation } from "react-i18next";
import { IoPersonAddOutline } from "react-icons/io5";
import styled from "styled-components";

import { StyledButton } from "@/components/styled/StyledButton";
import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/contexts/ModalContext";
import { User, ANONYMOUS_USER_UUID } from "@/services/user";
import Modal from "../Assets/Modal/Modal";
import LoginModal from "./LoginModal";

const UserList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 40vh;
  overflow-y: auto;
`;

const UserListItem = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid ${(props) => props.theme.colors.border};
  &:last-child {
    border-bottom: none;
  }
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const Username = styled.span`
  font-weight: bold;
  color: ${(props) => props.theme.colors.textPrimary};
`;

const ServerUrl = styled.span`
  font-size: 0.8rem;
  color: ${(props) => props.theme.colors.textSecondary};
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const CurrentUserTag = styled.span`
  font-size: 0.8rem;
  font-weight: bold;
  color: ${(props) => props.theme.colors.primary};
`;

const ModalFooter = styled.div`
  padding-top: 1.5rem;
  border-top: 1px solid ${(props) => props.theme.colors.border};
  display: flex;
  justify-content: flex-end;
`;

interface AccountSwitcherModalProps {
  onClose: () => void;
  isOpen: boolean;
}

/**
 * @component AccountSwitcherModal
 * @description 提供一个用户列表，允许用户在不同的已登录账户之间切换，或登出指定账户。
 */
const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({
  isOpen,
  onClose,
}) => {
  // --- Hooks ---
  const { t } = useTranslation();
  const { availableUsers, activeUser, switchActiveUser, logoutUser } =
    useAuth();
  const { openModal } = useModal();

  // --- 事件处理函数 ---

  /**
   * @function handleSwitch
   * @description 处理切换用户的操作。
   * @param {User} user - 目标用户对象。
   */
  const handleSwitch = (user: User) => {
    switchActiveUser(user); // 调用认证上下文中的方法来更新全局的 activeUser
    onClose(); // 操作完成后关闭当前模态框
  };

  /**
   * @function handleLogout
   * @description 处理登出指定用户的操作。
   * @param {User} user - 需要登出的用户对象。
   */
  const handleLogout = (user: User) => {
    logoutUser(user.uuid); // 调用认证上下文的方法，通过 UUID 将用户标记为离线
  };

  /**
   * @function handleAddAccount
   * @description 打开登录模态框，以添加一个新的账户。
   */
  const handleAddAccount = () => {
    onClose(); // 先关闭当前的账户切换模态框
    openModal((closeLoginModal) => (
      <LoginModal isOpen={true} onClose={closeLoginModal} />
    ));
  };

  // --- 渲染逻辑 ---

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("account.switchAccount.title")}
    >
      {/* 用户列表 */}
      <UserList>
        {/* 遍历所有“可用”用户（is_logged_in = 1），包括匿名用户 */}
        {availableUsers.map((user) => (
          <UserListItem key={user.uuid}>
            {/* 用户信息展示 */}
            <UserInfo>
              <Username>{user.username}</Username>
              {user.serverAddress && (
                <ServerUrl>{user.serverAddress}</ServerUrl>
              )}
            </UserInfo>

            {/* 操作按钮区域 */}
            <Actions>
              {user.uuid === activeUser?.uuid ? (
                <CurrentUserTag>
                  {t("account.switchAccount.current")}
                </CurrentUserTag>
              ) : (
                <StyledButton
                  variant="ghost"
                  onClick={() => handleSwitch(user)}
                >
                  {t("account.switchAccount.switch")}
                </StyledButton>
              )}

              {user.uuid !== ANONYMOUS_USER_UUID &&
                user.uuid !== activeUser?.uuid && (
                <>
                  <StyledButton
                    variant="ghost"
                    onClick={() => handleLogout(user)}
                  >
                    {t("account.logoutButton")}
                  </StyledButton>
                </>
              )}
            </Actions>
          </UserListItem>
        ))}
      </UserList>

      {/* 模态框底部，提供“登录其它账户”的入口 */}
      <ModalFooter>
        <StyledButton variant="secondary" onClick={handleAddAccount}>
          <IoPersonAddOutline style={{ marginRight: "8px" }} />
          {t("account.switchAccount.addAccount")}
        </StyledButton>
      </ModalFooter>
    </Modal>
  );
};

export default AccountSwitcherModal;
