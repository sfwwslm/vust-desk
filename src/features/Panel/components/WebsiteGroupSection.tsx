import React, { useState } from "react";
import { WebsiteGroup, WebsiteItem } from "@/features/Panel/types";
import { AnimatePresence } from "framer-motion";
import DynamicIcon from "@/components/common/DynamicIcon";
import {
  PanelGroupSectionStyles,
  SectionHeader,
  SectionTitle,
  ActionIcon,
  HeaderActions,
  PanelGrid,
  PanelCard,
  PanelCardContent,
  PanelIcon,
  PanelName,
} from "@/styles/panel/index.styles";
import {
  IoAddCircleOutline,
  IoSwapVertical,
  IoCheckmarkDoneSharp,
} from "react-icons/io5";
import Tooltip from "@/components/common/Tooltip/Tooltip";
import { useTranslation } from "react-i18next";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTheme } from "styled-components";

/** 可排序的网站卡片组件 */
const SortablePanelCard: React.FC<{
  item: WebsiteItem;
  isSorting: boolean;
  onCardClick: (item: WebsiteItem) => void;
  onContextMenu: (e: React.MouseEvent, item: WebsiteItem) => void;
}> = ({ item, isSorting, onCardClick, onContextMenu }) => {
  const theme = useTheme();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.uuid, disabled: !isSorting });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSorting) {
      e.preventDefault();
      return;
    }
    onCardClick(item);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isSorting) {
      e.preventDefault();
      return;
    }
    onContextMenu(e, item);
  };

  return (
    <PanelCard
      ref={setNodeRef}
      style={style}
      className="panel-card-wrapper"
      background_color={item.background_color}
      onClick={handleCardClick}
      onContextMenu={handleContextMenu}
      isDragging={isDragging}
      isSorting={isSorting}
      {...(isSorting ? listeners : {})}
      {...attributes}
    >
      <PanelCardContent className="panel-card-content">
        <PanelIcon className="panel-icon">
          <DynamicIcon
            defaultIcon={item.default_icon}
            localIconPath={item.local_icon_path}
            imgStyle={{ borderRadius: theme.radii.base }}
          />
        </PanelIcon>
        <PanelName className="panel-name">{item.title}</PanelName>
      </PanelCardContent>
    </PanelCard>
  );
};

interface WebsiteGroupSectionProps {
  group: WebsiteGroup;
  items: WebsiteItem[]; // items 作为独立的 prop 传入
  onAddItem: (groupUuid: string) => void;
  onCardClick: (item: WebsiteItem) => void;
  onContextMenu: (e: React.MouseEvent, item: WebsiteItem) => void;
}

const WebsiteGroupSection: React.FC<WebsiteGroupSectionProps> = ({
  group,
  items,
  onAddItem,
  onCardClick,
  onContextMenu,
}) => {
  const { t } = useTranslation();
  const [isSorting, setIsSorting] = useState(false);

  return (
    <PanelGroupSectionStyles className="panel-group-section">
      <SectionHeader
        className={`panel-group-section-header ${
          isSorting ? "is-sorting" : ""
        }`}
      >
        <SectionTitle>{group.name}</SectionTitle>
        <HeaderActions>
          <Tooltip text={isSorting ? t("panel.sortDone") : t("panel.sort")}>
            <ActionIcon
              onClick={() => setIsSorting(!isSorting)}
              className="sort-items-action-icon"
            >
              {isSorting ? <IoCheckmarkDoneSharp /> : <IoSwapVertical />}
            </ActionIcon>
          </Tooltip>
          <Tooltip text={t("panel.addItem")}>
            <ActionIcon
              onClick={() => onAddItem(group.uuid)}
              className="add-item-action-icon"
            >
              <IoAddCircleOutline />
            </ActionIcon>
          </Tooltip>
        </HeaderActions>
      </SectionHeader>
      <SortableContext
        items={items.map((i) => i.uuid)}
        strategy={rectSortingStrategy}
        disabled={!isSorting}
      >
        <PanelGrid className="panel-grid">
          <AnimatePresence>
            {items.map((item) => (
              <SortablePanelCard
                key={item.uuid}
                item={item}
                isSorting={isSorting}
                onCardClick={onCardClick}
                onContextMenu={onContextMenu}
              />
            ))}
          </AnimatePresence>
        </PanelGrid>
      </SortableContext>
    </PanelGroupSectionStyles>
  );
};

export default React.memo(WebsiteGroupSection);
