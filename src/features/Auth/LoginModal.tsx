import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { useAuth } from "@/contexts/AuthContext";
import useLocalStorage from "@/hooks/useLocalStorage";
import { useModal } from "@/contexts/ModalContext";
import {
  Input,
  FormGroup,
  Label as BaseLabel,
} from "@/components/styled/StyledForm";
import { StyledButton } from "@/components/styled/StyledButton";
import Modal from "@/features/Assets/Modal/Modal";

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ServerConfigGrid = styled.div`
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 0.8rem;
`;

const SslCheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ErrorMessage = styled.p`
  color: ${(props) => props.theme.colors.error};
  font-size: 0.9rem;
  text-align: center;
  word-break: break-all;
  margin-top: 0.5rem;
`;

interface LoginModalProps {
  onClose: () => void;
  isOpen: boolean;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, isOpen }) => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { openConfirm } = useModal();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [serverIp, setServerIp] = useLocalStorage("serverIp", "127.0.0.1");
  // serverPort 仍然使用 useLocalStorage 以便记住用户的非HTTPS端口或IP
  const [serverPort, setServerPort] = useLocalStorage("serverPort", "9990");
  const [useHttps, setUseHttps] = useState(true);

  /**
   * @effect
   * @description 当模态框打开时，强制重置所有表单状态。
   * @logic_comment
   * 此 effect 监听 `isOpen` 状态。当 `isOpen` 变为 `true` 时，
   * 会将所有与表单输入相关的状态（HTTPS、端口、用户名、密码、错误信息）
   * 全部重置为初始值，确保用户每次看到的都是一个干净的表单。
   */
  useEffect(() => {
    if (isOpen) {
      setUseHttps(true);
      setServerPort("9991");
      // 清空用户名和密码状态
      setUsername("");
      setPassword("");
      setError(""); // 同时清空上一次的错误提示
    }
  }, [isOpen, setServerPort]);

  const handleHttpsToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabling = e.target.checked;

    if (isEnabling) {
      setUseHttps(true);
      setServerPort("9991"); // 重新勾选时，端口变回 9991
    } else {
      openConfirm({
        title: t("account.httpsWarning.title"),
        message: t("account.httpsWarning.message"),
        confirmText: t("account.httpsWarning.confirmButton"),
        cancelText: t("account.httpsWarning.cancelButton"),
        onConfirm: () => {
          setUseHttps(false);
          setServerPort("9990"); // 用户确认风险后，端口变回 9990
        },
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const address = `${serverIp}:${serverPort}`;
      await login(username, password, address, useHttps);
      onClose();
    } catch (err: any) {
      setError(err.message || t("account.unknownError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("account.title")}>
      <Form onSubmit={handleSubmit}>
        <ServerConfigGrid>
          <FormGroup>
            <BaseLabel htmlFor="server-ip">{t("account.serverIp")}</BaseLabel>
            <Input
              id="server-ip"
              className="server-ip-input"
              type="text"
              value={serverIp}
              onChange={(e) => setServerIp(e.target.value)}
              placeholder="e.g., 127.0.0.1"
            />
          </FormGroup>
          <FormGroup>
            <BaseLabel htmlFor="server-port">{t("account.port")}</BaseLabel>
            <Input
              id="server-port"
              className="server-port-input"
              type="number"
              value={serverPort}
              onChange={(e) => setServerPort(e.target.value)}
              placeholder="e.g., 9990"
            />
          </FormGroup>
        </ServerConfigGrid>

        <SslCheckboxContainer>
          <input
            id="use-https"
            className="ssl-checkbox"
            type="checkbox"
            checked={useHttps}
            onChange={handleHttpsToggle}
          />
          <BaseLabel htmlFor="use-https">{t("account.enableSsl")}</BaseLabel>
        </SslCheckboxContainer>

        <FormGroup>
          <BaseLabel htmlFor="username">{t("account.username")}</BaseLabel>
          <Input
            id="username"
            className="username-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </FormGroup>
        <FormGroup>
          <BaseLabel htmlFor="password">{t("account.password")}</BaseLabel>
          <Input
            id="password"
            className="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormGroup>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <StyledButton
          type="submit"
          variant="primary"
          disabled={isLoading}
          style={{ marginTop: "0.5rem" }}
        >
          {isLoading ? t("account.loggingIn") : t("account.loginButton")}
        </StyledButton>
      </Form>
    </Modal>
  );
};

export default LoginModal;
