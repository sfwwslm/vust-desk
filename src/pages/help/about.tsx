import { useState, useEffect } from "react";
import { getVersion, getTauriVersion } from "@tauri-apps/api/app";
import styled from "styled-components";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import Tooltip from "@/components/common/Tooltip/Tooltip";

const AboutContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  background-color: transparent;
  color: ${(props) => props.theme.colors.textPrimary};
`;

const Content = styled.div`
  text-align: center;
  max-width: 80%;
  margin-top: -20vh;
  color: ${(props) => props.theme.colors.textPrimary};

  p {
    font-weight: bold;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
`;

const Version = styled.div`
  position: absolute;
  right: 3rem;
  bottom: 1.5rem;
  font-size: 0.9rem;
  font-weight: bold;
  text-align: left;
  color: ${(props) => props.theme.colors.textPrimary};

  p {
    cursor: pointer;
    &:hover {
      color: ${(props) => props.theme.colors.primary};
    }
  }
`;

const Paragraph = styled.p`
  font-size: 1rem;
  font-weight: bold;
  margin-bottom: 1rem;
`;

/**
 * 关于页面
 * @description 显示应用、框架和构建版本等信息
 */
export default function About() {
  const [appVersion, setAppVersion] = useState("...");
  const [tauriVersion, setTauriVersion] = useState("...");
  const { t } = useTranslation();

  /**
   * 提取纯版本号（去除 npm 前缀、包名、范围符号）
   * 支持例如：
   * - "npm:rolldown-vite@7.2.7"
   * - "^1.4.0"
   * - "~2.0.3"
   * - ">=3.1.0"
   * - "@scope/pkg@1.0.0"
   */
  function extractVersion(version: string): string {
    if (!version) return "";

    // npm:xxx@1.2.3 或 xxx@1.2.3
    const atIndex = version.lastIndexOf("@");
    if (atIndex > 0) {
      version = version.slice(atIndex + 1);
    }

    // 移除范围符号。如: ^ ~ >= <= >
    return version.replace(/^(>=|<=|>|<|\^|~)/, "");
  }

  useEffect(() => {
    getVersion().then(setAppVersion);
    getTauriVersion().then(setTauriVersion);
  }, []);

  return (
    <AboutContainer className="about-container">
      <Content>
        <Paragraph>{t("help.about.tagline")}</Paragraph>
      </Content>
      <Version className="version" style={{ display: "grid" }}>
        <Tooltip text={`Commit: ${__GIT_HASH__}`}>
          {/* 为了避免 Tooltip 影响 p 标签的 hover 效果，将 p 标签的样式移到 style 属性中 */}
          <p style={{ cursor: "default", color: "inherit" }}>
            Version: {appVersion}
          </p>
        </Tooltip>

        <Tooltip text={t("help.about.openTauriWebsite")}>
          <p onClick={async () => await openUrl(t("help.about.tauriUrl"))}>
            Tauri: {tauriVersion}
          </p>
        </Tooltip>

        <Tooltip text={t("help.about.openReactWebsite")}>
          <p onClick={async () => await openUrl(t("help.about.reactUrl"))}>
            React: {extractVersion(__REACT_VERSION__)}
          </p>
        </Tooltip>

        <Tooltip text={t("help.about.openViteWebsite")}>
          <p onClick={async () => await openUrl(t("help.about.viteUrl"))}>
            Vite: {extractVersion(__VITE_VERSION__)}
          </p>
        </Tooltip>
      </Version>
    </AboutContainer>
  );
}
