/**
 * @file sync.ts
 * @brief 使用了精确类型定义的业务逻辑代码, 为了与数据库和后端代码的命名符合统一使用 snake_case 命名。
 * @author gwj
 * @date 2025年9月30日
 */

import { User } from "@/services/user";

/**
 * 通用服务器响应结构，与 Rust 中的 `ApiResponse<T>` 对应。
 */
export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data?: T | null; // Option<T> 映射为 T | null，并且字段可选
}

/**
 * 网站分组的数据传输对象，与 Rust 中的 `WebsiteGroupDto` 对应。
 */
export interface WebsiteGroupDto {
  uuid: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_deleted: number;
  updated_at: string;
}

/**
 * 网站项的数据传输对象，与 Rust 中的 `WebsitesDto` 对应。
 */
export interface WebsitesDto {
  uuid: string;
  group_uuid: string;
  title: string;
  url: string;
  url_lan: string | null;
  default_icon: string | null;
  local_icon_path: string | null;
  background_color: string | null;
  description: string | null;
  sort_order: number | null;
  is_deleted: number;
  updated_at: string;
}

/**
 * 资产分类的数据传输对象，与 Rust 中的 `AssetCategoryDto` 对应。
 */
export interface AssetCategoryDto {
  uuid: string;
  name: string;
  is_default: number;
  is_deleted: number;
  updated_at: string;
}

/**
 * 资产的数据传输对象，与 Rust 中的 `AssetDto` 对应。
 */
export interface AssetDto {
  uuid: string;
  category_uuid: string;
  name: string;
  purchase_date: string;
  price: number;
  expiration_date: string | null;
  description: string | null;
  is_deleted: number;
  updated_at: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  sale_price: number | null;
  sale_date: string | null;
  fees: number | null;
  buyer: string | null;
  notes: string | null;
  realized_profit: number | null;
}

/**
 * 搜索引擎的数据传输对象
 */
export interface SearchEngineDto {
  uuid: string;
  name: string;
  url_template: string;
  default_icon: string | null;
  local_icon_path: string | null;
  is_default: number;
  sort_order: number | null;
  updated_at: string;
}

/**
 * 同步数据包的核心内容，与 Rust 中的 `SyncDataDto` 对应。
 * 注意：Rust 结构体使用了 `rename_all = "camelCase"`，因此属性名使用驼峰式。
 */
export interface SyncDataDto {
  website_groups: WebsiteGroupDto[];
  websites: WebsitesDto[];
  asset_categories: AssetCategoryDto[];
  assets: AssetDto[];
  search_engines: SearchEngineDto[];
}

/**
 * 服务器返回的完整同步数据结构，与 Rust 中的 `ServerSyncData` 对应。
 */
export interface ServerSyncData {
  current_synced_at: string;
  sync_data: SyncDataDto;
  icons_to_upload: string[]; // 需要客户端上传的图标文件名列表
  icons_to_download: string[]; // 需要客户端下载的图标文件名列表
  website_groups_count: number;
  websites_count: number;
  categories_count: number;
  assets_count: number;
  search_engines_count: number;
}

/**
 * @interface ClientSyncPayload
 * @description 客户端发起同步时，`sync/start` 接口的请求体。
 */
export interface ClientSyncPayload {
  user_uuid: string;
  last_synced_at: string;
}

/**
 * @interface StartSyncResponse
 * @description `sync/start` 接口成功响应后，服务器返回的数据结构。
 */
export interface StartSyncResponse {
  session_id: string;
  // 未来可扩展字段，例如服务器建议的分块大小等
}

/**
 * @enum DataType
 * @description 定义了同步数据块的类型，确保客户端和服务端使用一致的标识符。
 */
export enum DataType {
  WebsiteGroups = "WebsiteGroups",
  Websites = "Websites",
  AssetCategories = "AssetCategories",
  Assets = "Assets",
  SearchEngines = "SearchEngines",
  LocalIcons = "LocalIcons",
}

/**
 * @interface ClientSyncDataChunk
 * @description 客户端向 `sync/chunk` 接口发送的单个数据块的结构。
 */
export interface ClientSyncDataChunk {
  session_id: string;
  data_type: DataType;
  chunk_data:
    | WebsiteGroupDto[]
    | WebsitesDto[]
    | AssetCategoryDto[]
    | AssetDto[]
    | SearchEngineDto[]
    | string[];
}

export interface SyncStatusUpdaters {
  setIsSyncing: (isSyncing: boolean) => void;
  setSyncMessage: (message: string) => void;
  setSyncCompleted: (completed: boolean) => void;
  incrementDataVersion: () => void;
  switchActiveUser: (user: User) => void;
  refreshAvailableUsers: () => Promise<User[]>;
  // 将 t 函数作为参数传入
  t: (key: string, options?: any) => string;
}

export interface CurrentUserPayload {
  username: string;
}

/**
 * @brief 客户端信息。
 */
export interface ClientInfoDto {
  app_version: string;
  username: string;
  token: string;
  server_address: string;
}
