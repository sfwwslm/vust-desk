import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { usePanelSettings } from "@/contexts/PanelSettingsContext";

const SettingsContainer = styled.div`
  padding: 1rem;
`;

const SettingsArea = styled.div`
  margin-bottom: 2rem;
`;

const AreaTitle = styled.h3`
  font-size: 1.2rem;
  color: ${(props) => props.theme.colors.textPrimary};
  margin-bottom: 1rem;
  border-bottom: 1px solid ${(props) => props.theme.colors.border};
  padding-bottom: 0.5rem;
`;

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const SettingLabel = styled.label`
  color: ${(props) => props.theme.colors.textSecondary};
  min-width: 120px;
`;

const SliderInput = styled.input`
  flex-grow: 1;
`;

const SliderValue = styled.span`
  min-width: 40px;
  text-align: right;
  font-weight: bold;
  color: ${(props) => props.theme.colors.primary};
`;

const PanelPersonalizationSettings: React.FC = () => {
  const { t } = useTranslation();
  const { sideMargin: persistedMargin, setSideMargin: setPersistedMargin } =
    usePanelSettings();

  const [liveMargin, setLiveMargin] = useState(persistedMargin);

  // 当持久化的值变化时，同步本地状态和CSS变量
  useEffect(() => {
    setLiveMargin(persistedMargin);
    document.documentElement.style.setProperty(
      "--panel-side-margin-percent",
      `${persistedMargin}`,
    );
  }, [persistedMargin]);

  // 拖动滑块时，仅更新本地状态和CSS变量
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    setLiveMargin(newValue);
    document.documentElement.style.setProperty(
      "--panel-side-margin-percent",
      `${newValue}`,
    );
  };

  // 拖动结束后，更新Context中的持久化状态
  const handleDragEnd = () => {
    setPersistedMargin(liveMargin);
  };

  return (
    <SettingsContainer>
      <SettingsArea>
        <AreaTitle>{t("panel.settings.contentArea")}</AreaTitle>
        <SettingRow>
          <SettingLabel>{t("panel.settings.sideMargin")}</SettingLabel>
          <SliderInput
            type="range"
            min="0"
            max="20"
            value={liveMargin}
            onChange={handleSliderChange} // 实时视觉更新
            onMouseUp={handleDragEnd} // 拖动结束后持久化
            onTouchEnd={handleDragEnd} // 兼容触摸设备
          />
          <SliderValue>{liveMargin}%</SliderValue>
        </SettingRow>
      </SettingsArea>
    </SettingsContainer>
  );
};

export default PanelPersonalizationSettings;
