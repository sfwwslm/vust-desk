import React from "react";
import styled from "styled-components";
import { useAuth } from "@/contexts/AuthContext";
import {
  IoPersonCircleOutline,
  IoSyncOutline,
  IoLogInOutline,
} from "react-icons/io5";
import { MdOutlineSwitchAccount } from "react-icons/md";
import { motion } from "framer-motion";
import { StyledButton } from "@/components/styled/StyledButton";
import { useTranslation } from "react-i18next";
import { ANONYMOUS_USER_UUID } from "@/services/user";
import { useSync } from "@/contexts/SyncContext";
import { startSync } from "@/services/sync";
import { useModal } from "@/contexts/ModalContext";
import AccountSwitcherModal from "./AccountSwitcherModal";
import LoginModal from "./LoginModal";

/**
 * @description 模态框的根容器，带有定位和样式
 */
const CardContainer = styled(motion.div)`
  width: 280px;
  background-color: ${(props) => props.theme.colors.surface};
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: ${(props) => props.theme.radii.base};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem; /* 内部元素间距 */
`;

/**
 * @description 用户头像和名称的容器
 */
const ProfileSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem; // 减小用户名和UID的间距
`;

/**
 * @description 头像图标样式
 */
const Avatar = styled(IoPersonCircleOutline)`
  font-size: 5rem; /* 放大头像图标 */
  color: ${(props) => props.theme.colors.primary};
`;

/**
 * @description 用户名文本样式
 */
const Username = styled.p`
  font-size: 1.2rem;
  font-weight: 600;
  color: ${(props) => props.theme.colors.textPrimary};
  word-break: break-all; /* 防止长用户名溢出 */
`;

/** UID 样式 */
const UserUid = styled.p`
  font-size: 0.8rem;
  color: ${(props) => props.theme.colors.textSecondary};
  font-family: "Courier New", Courier, monospace;
`;

/**
 * @description 未来可扩展的操作区
 */
const ActionsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-top: 1px solid ${(props) => props.theme.colors.border};
  padding-top: 1.5rem;
`;

interface UserProfileCardProps {
  onClose: () => void; // 关闭模态框的回调
}

/**
 * @component UserProfileCard
 * @description 一个展示当前用户信息的模态框（卡片），提供账户相关操作入口。
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const {
    activeUser,
    logout,
    isLoggedIn,
    incrementDataVersion,
    switchActiveUser,
    availableUsers,
    refreshAvailableUsers,
  } = useAuth();
  const { isSyncing, setIsSyncing, setSyncMessage, setSyncCompleted } =
    useSync();
  const { openModal } = useModal();

  // --- 业务逻辑：判断是否存在可切换的真实用户 ---
  /**
   * @description 检查是否存在至少一个非匿名的、已登录的用户账户。
   * 此状态用于决定在匿名用户视图下是否显示“切换账户”按钮。
   */
  const hasSwitchableUsers = availableUsers.some(
    (u) => u.uuid !== ANONYMOUS_USER_UUID
  );

  // --- 事件处理函数 ---

  /**
   * @function handleLogout
   * @description 处理当前用户的登出操作。
   */
  const handleLogout = () => {
    logout(); // 调用认证上下文提供的登出方法
    onClose(); // 关闭当前卡片
  };

  /**
   * @function handleSync
   * @description 触发数据同步流程。
   */
  const handleSync = async () => {
    // 防止在没有活动用户或正在同步时重复触发
    if (!activeUser || isSyncing) return;
    onClose(); // 操作开始前先关闭卡片，避免遮挡同步遮罩层
    setSyncMessage(t("sync.preparingSync")); // 设置同步初始提示信息
    // 调用同步服务，并传入所有UI更新所需的回调函数
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

  /**
   * @function openAccountSwitcher
   * @description 打开账户切换模态框。
   */
  const openAccountSwitcher = () => {
    onClose(); // 先关闭当前卡片
    // 打开新的模态框，确保同一时间只有一个模态框（由 key 控制）
    openModal(
      (close) => <AccountSwitcherModal isOpen={true} onClose={close} />,
      {
        key: "account-switcher",
      }
    );
  };

  /**
   * @function openLoginModal
   * @description 打开登录模态框。
   */
  const openLoginModal = () => {
    onClose(); // 先关闭当前卡片
    openModal((close) => <LoginModal isOpen={true} onClose={close} />, {
      key: "login",
    });
  };

  // --- 渲染逻辑 ---

  /**
   * @description 核心业务判断：通过UUID精确识别当前是否为匿名用户。
   * 这是区分“真实登录用户”和“匿名占位用户”的关键。
   */
  const isAnonymous = activeUser?.uuid === ANONYMOUS_USER_UUID;

  return (
    <CardContainer
      className="user-profile-card"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      {/* 用户基本信息展示区 */}
      {activeUser && (
        <ProfileSection>
          <Avatar />
          <Username>{activeUser.username}</Username>
          <UserUid>uid: {activeUser.uuid.substring(0, 5)}</UserUid>
        </ProfileSection>
      )}

      {/* 用户操作区，根据登录状态和是否为匿名用户显示不同按钮 */}
      <ActionsSection>
        {isLoggedIn && !isAnonymous ? (
          // --- 已登录的真实用户视图 ---
          <>
            {/* 数据同步按钮 */}
            <StyledButton
              variant="secondary"
              onClick={handleSync}
              disabled={isSyncing}
              className="sync-data-button-card"
            >
              <IoSyncOutline style={{ marginRight: "8px" }} />
              {isSyncing ? t("account.syncing") : t("account.dataSync")}
            </StyledButton>
            
            {/* 切换账户按钮 */}
            <StyledButton variant="secondary" onClick={openAccountSwitcher}>
              <MdOutlineSwitchAccount style={{ marginRight: "8px" }} />
              {t("account.switchAccount.title")}
            </StyledButton>
            
            {/* 登出按钮 */}
            <StyledButton variant="danger" onClick={handleLogout}>
              {t("account.logoutButton")}
            </StyledButton>
          </>
        ) : (
          // --- 匿名用户视图 ---
          <>
            {/* 登录按钮，始终为匿名用户显示 */}
            <StyledButton variant="secondary" onClick={openLoginModal}>
              <IoLogInOutline style={{ marginRight: "8px" }} />
              {t("account.title")}
            </StyledButton>

            {/* 如果存在其他已登录账户，则提供切换入口 */}
            {hasSwitchableUsers && (
              <StyledButton variant="secondary" onClick={openAccountSwitcher}>
                <MdOutlineSwitchAccount style={{ marginRight: "8px" }} />
                {t("account.switchAccount.title")}
              </StyledButton>
            )}
          </>
        )}
      </ActionsSection>
    </CardContainer>
  );
};

export default UserProfileCard;