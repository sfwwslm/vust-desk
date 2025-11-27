import React, { useState, useEffect } from "react";
import { IoGlobeOutline, IoWarningOutline } from "react-icons/io5";
import { Icon as Iconify, loadIcon } from "@iconify/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import * as log from "@tauri-apps/plugin-log";
import { useIconRefresh } from "@/contexts/IconRefreshContext";
import { join } from "@tauri-apps/api/path";
import { getIconsDir } from "@/utils/fs";

/**
 * @component IconifyWrapper
 * @description 一个内部组件，用于处理Iconify图标的加载和回退逻辑。
 * @param {object} props
 * @param {string} props.icon - Iconify图标的名称 (例如 "grommet-icons:edge")
 * @param {React.ReactNode} props.fallback - 加载失败时要显示的备用图标组件
 */
const IconifyWrapper: React.FC<{ icon: string; fallback: React.ReactNode }> = ({
  icon,
  fallback,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    loadIcon(icon)
      .then(() => setIsLoaded(true))
      .catch((err) => {
        log.warn(`无法加载Iconify图标 "${icon}": ${err}。将使用备用图标。`);
        setHasError(true);
      });
  }, [icon]);

  if (hasError || !isLoaded) {
    return <>{fallback}</>;
  }
  return <Iconify icon={icon} />;
};

interface DynamicIconProps {
  defaultIcon?: React.ComponentType<any> | string | null;
  localIconPath?: string | null;
  onLoadError?: () => void;
  imgStyle?: React.CSSProperties;
}

const DynamicIcon: React.FC<DynamicIconProps> = ({
  defaultIcon,
  localIconPath,
  onLoadError,
  imgStyle,
}) => {
  const [fullIconSrc, setFullIconSrc] = useState<string | null>(null);
  const [localIconFailed, setLocalIconFailed] = useState(false);
  const { iconRetryKey } = useIconRefresh();

  useEffect(() => {
    // 当 localIconPath (文件名) 或刷新信号变化时
    const resolveIconPath = async () => {
      if (localIconPath) {
        try {
          // 动态拼接完整路径
          const iconsDir = await getIconsDir();
          const fullPath = await join(iconsDir, localIconPath);
          setFullIconSrc(convertFileSrc(fullPath));
        } catch (e) {
          log.error(`拼接或转换图标路径时出错: ${e}`);
          setLocalIconFailed(true);
        }
      } else {
        setFullIconSrc(null);
      }
    };

    resolveIconPath();
    setLocalIconFailed(false);
  }, [localIconPath, iconRetryKey]);

  // 将 IoGlobeOutline 作为通用备用图标
  const GenericFallbackIcon = IoGlobeOutline;
  const ErrorIcon = () => <IoWarningOutline style={{ color: "red" }} />;

  // 1. 优先使用本地图标路径
  if (fullIconSrc && !localIconFailed) {
    return (
      <img
        src={fullIconSrc}
        alt="Favicon"
        className="local-favicon"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          ...imgStyle,
        }}
        onError={() => {
          log.error(`本地图标加载失败: ${fullIconSrc}`);
          setLocalIconFailed(true);
          onLoadError?.();
        }}
      />
    );
  }

  if (localIconFailed) {
    return <ErrorIcon />;
  }

  // 如果没有 defaultIcon，则直接使用备用图标
  if (!defaultIcon) {
    return <GenericFallbackIcon />;
  }

  // 2. 如果 defaultIcon 是一个 React 组件 (内置图标)，直接渲染
  if (typeof defaultIcon === "function") {
    const IconComponent = defaultIcon;
    return <IconComponent />;
  }

  // 3. 如果是 Iconify 格式的字符串 (在线图标)
  if (typeof defaultIcon === "string" && defaultIcon.includes(":")) {
    return (
      <IconifyWrapper icon={defaultIcon} fallback={<GenericFallbackIcon />} />
    );
  }

  // 所有情况均不匹配时，返回最终的备用图标
  return <GenericFallbackIcon />;
};

export default DynamicIcon;
