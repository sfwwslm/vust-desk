use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 服务器接口响应类型，与服务器中定义的数据结构一致
#[derive(Serialize, Deserialize, Debug)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub code: i32,
    pub message: String,
    pub data: Option<T>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct WebsiteGroupDto {
    pub uuid: String,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: Option<i64>, // Rust 中对应 SQLite 的 INTEGER
    pub is_deleted: i64,         // 对应 SQLite 的 INTEGER (0 或 1)
    pub rev: i64,
    pub updated_at: String,      // ISO 8601 格式的字符串
}

#[derive(Serialize, Deserialize, Debug)]
pub struct WebsitesDto {
    pub uuid: String,
    pub group_uuid: String, // 关系字段必须保留
    pub title: String,
    pub url: String,
    pub url_lan: Option<String>,
    pub default_icon: Option<String>,
    pub local_icon_path: Option<String>,
    pub background_color: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i64>,
    pub is_deleted: i64,
    pub rev: i64,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AssetCategoryDto {
    pub uuid: String,
    pub name: String,
    pub is_default: i64, // 服务器可能需要根据这个标志做特殊处理
    pub is_deleted: i64,
    pub rev: i64,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AssetDto {
    pub uuid: String,
    pub category_uuid: String, // 关系字段必须保留
    pub name: String,
    pub purchase_date: String,
    pub price: f64, // 对应 SQLite 的 REAL
    pub expiration_date: Option<String>,
    pub description: Option<String>,
    pub is_deleted: i64,
    pub rev: i64,
    pub updated_at: String,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SearchEngineDto {
    pub uuid: String,
    pub name: String,
    pub url_template: String,
    pub default_icon: Option<String>,
    pub local_icon_path: Option<String>,
    pub is_default: i64,
    pub sort_order: Option<i64>,
    pub is_deleted: i64,
    pub rev: i64,
    pub updated_at: String,
}

// 定义同步数据的结构
#[derive(Serialize, Deserialize, Debug)]
pub struct SyncDataDto {
    pub website_groups: Vec<WebsiteGroupDto>,
    pub websites: Vec<WebsitesDto>,
    pub asset_categories: Vec<AssetCategoryDto>,
    pub assets: Vec<AssetDto>,
    pub search_engines: Vec<SearchEngineDto>,
}

/// 服务端成功同步后返回的数据
#[derive(Debug, Serialize, Deserialize)]
pub struct ServerSyncData {
    pub current_synced_rev: i64,
    pub current_synced_at: String,
    pub sync_data: SyncDataDto,
    pub icons_to_upload: Vec<String>, // 需要客户端上传的图标文件名列表
    pub icons_to_download: Vec<String>, // 需要客户端下载的图标文件名列表
    pub website_groups_count: usize,
    pub websites_count: usize,
    pub categories_count: usize,
    pub assets_count: usize,
    pub search_engines_count: usize,
}

/// 定义从客户端发送的数据结构
#[derive(Serialize, Deserialize, Debug)]
pub struct ClientSyncData {
    pub user_uuid: String, // 用户UUID，只发送一次
    pub last_synced_rev: i64,
    pub sync_data: SyncDataDto,
    pub local_icons: Vec<String>, // 客户端本地拥有的所有图标文件名
}

/// 定义客户端信息
#[derive(Serialize, Deserialize, Debug)]
pub struct ClientInfoDto {
    pub app_version: String,
    pub username: String,
    pub token: String,
    pub server_address: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VersionInfo {
    pub version: String,
    pub commit_hash: String,
    pub build_time: String,
    pub build_env: String,
}

/// `sync/start` 接口的请求体
#[derive(Serialize, Deserialize, Debug)]
pub struct ClientSyncPayload {
    pub user_uuid: String,
    pub last_synced_rev: i64,
}

/// `sync/start` 接口的成功响应数据
#[derive(Serialize, Deserialize, Debug)]
pub struct StartSyncResponse {
    pub session_id: String,
    pub suggested_chunk_size: Option<usize>,
}

/// 数据块的类型枚举
#[derive(Serialize, Deserialize, Debug)]
pub enum DataType {
    WebsiteGroups,
    Websites,
    AssetCategories,
    Assets,
    SearchEngines,
    LocalIcons,
}

/// `sync/chunk` 接口的请求体
#[derive(Serialize, Deserialize, Debug)]
pub struct ClientSyncDataChunk {
    pub session_id: String,
    pub data_type: DataType,
    // 使用 serde_json::Value 来灵活接收不同类型的数组
    pub chunk_data: Value,
}
