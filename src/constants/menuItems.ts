import { TFunction } from "i18next";

/**
 * 定义菜单项的类型
 */
export type MenuItem = {
  id: number;
  label: string;
  url: string; // 菜单项对应的URL
  children?: MenuItem[]; // 可选的子菜单项，实现嵌套
};

/**
 * 菜单项数据生成函数
 * @param t - i18next 的翻译函数
 * @returns {MenuItem[]}
 */
export const getMenuItems = (t: TFunction): MenuItem[] => [
  {
    id: 100,
    label: t("menu.navigation"),
    url: "/",
  },
  {
    id: 200,
    label: t("menu.admin.title"),
    url: "",
    children: [
      {
        id: 201,
        label: t("menu.admin.assets"),
        url: "/admin/assets",
      },
    ],
  },
  {
    id: 1000,
    label: t("menu.help.title"),
    url: "",
    children: [
      {
        id: 1001,
        label: t("menu.help.settings"),
        url: "/help/settings",
      },
      {
        id: 1002,
        label: t("menu.help.update"),
        url: "/help/update",
      },
      {
        id: 1003,
        label: t("menu.help.changelog"),
        url: "/help/changelog",
      },
      {
        id: 1099,
        label: t("menu.help.about"),
        url: "/help/about",
      },
    ],
  },
];
