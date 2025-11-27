import React from "react";
import AssetDashboard from "@/features/Assets/Dashboard/AssetDashboard";
import { useTheme } from "styled-components";
import { Theme } from "@/styles/themes";

const AssetsPage: React.FC = () => {
  const theme = useTheme() as Theme;
  return <AssetDashboard theme={theme} />;
};

export default AssetsPage;
