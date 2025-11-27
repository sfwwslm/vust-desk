use serde::{Deserialize, Serialize};

/// 服务端返回的最新用户数据
///
/// /auth/status 接口的响应结构体中的 data 字段
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurrentUserPayload {
    pub username: String,
}

// 定义前端传来的 User 结构
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub uuid: String,
    pub username: String,
    pub is_logged_in: i32,
    pub server_address: Option<String>,
    pub server_instance_uuid: Option<String>,
    pub token: Option<String>,
}
