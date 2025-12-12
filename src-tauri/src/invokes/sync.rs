use crate::types::{
    APP_CONFIG_DIR, HOME_VUST_DIR,
    session::{CurrentUserPayload, User},
    sync::{
        ClientInfoDto, ClientSyncDataChunk, ClientSyncPayload, ApiResponse, ServerSyncData,
        StartSyncResponse, VersionInfo,
    },
};

use std::path::PathBuf;
use std::time::Duration;
use std::{fs, io::Write};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_http::reqwest::{
    Client,
    multipart::{Form, Part},
};

#[tauri::command(rename_all = "snake_case")]
pub async fn check_client_version(
    http_client: State<'_, Client>,
    client_info: ClientInfoDto,
) -> Result<ApiResponse<String>, String> {
    log::info!(
        "当前客户端版本：{}，发往同步服务器进行兼容性校验...",
        &client_info.app_version
    );

    let url = format!("{}/api/v1/sync/verifying", &client_info.server_address);

    let response = http_client
        .post(url)
        .bearer_auth(&client_info.token)
        .json(&client_info)
        .send()
        .await;

    match response {
        Ok(res) => match res.json::<ApiResponse<String>>().await {
            Ok(json) => {
                if json.success {
                    log::info!("版本兼容性验证成功: {:?}", json);
                    Ok(json)
                } else {
                    log::error!("版本兼容性验证失败: {:?}", json);
                    Err(json.data.unwrap())
                }
            }
            Err(e) => {
                log::error!("版本兼容性检查时解析 Json 失败: {}", e);
                Err("版本兼容性检查时解析 Json 失败".to_string())
            }
        },

        Err(e) => {
            log::error!("版本兼容性检查时请求失败: {}", e);
            Err("版本兼容性检查时请求失败".to_string())
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn check_server_version(
    http_client: State<'_, Client>,
    server_address: String,
) -> Result<ApiResponse<VersionInfo>, String> {
    log::info!("正在检查服务器版本兼容性...");
    let url = format!("{}/api/version", server_address);

    let response = http_client.get(url).send().await;

    match response {
        Ok(res) => res
            .json::<ApiResponse<VersionInfo>>()
            .await
            .map_err(|e| format!("解析服务器版本失败: {e}")),
        Err(e) => Err(format!("请求服务器版本失败: {e}")),
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn check_token_and_user(
    app: AppHandle,
    http_client: State<'_, Client>,
    client_info: ClientInfoDto,
) -> Result<String, String> {
    log::info!(
        "正在为用户 {:?} 验证 Token 和用户信息...",
        &client_info.username
    );

    let url = format!("{}/api/v1/auth/status", &client_info.server_address);

    let response = http_client
        .get(url)
        .bearer_auth(client_info.token)
        .send()
        .await;

    match response {
        Ok(res) => {
            if !res.status().is_success() {
                let status = res.status();
                let error_text = res.text().await.unwrap_or_else(|_| "无法读取响应体".into());

                log::error!("服务器返回错误状态: {status} - {error_text}");
                return Err(error_text);
            }

            // 使用 map_err 来优雅地处理反序列化可能出现的错误，避免 .unwrap()
            match res.json::<ApiResponse<CurrentUserPayload>>().await {
                Ok(resp) => {
                    if resp.success {
                        // 判断用户名是否发生变更
                        let current_user_payload =
                            resp.data.expect("校验 JWT 接口响应中缺少用户数据！");
                        if client_info.username != current_user_payload.username {
                            log::info!("用户名已变更通知前端同步用户信息！");
                            app.emit_to("main", "user-rename", current_user_payload)
                                .expect("发送用户名变更事件失败！");
                        }

                        // API 逻辑上的成功
                        log::info!("Token 验证成功: {}", resp.message);
                        Ok(resp.message)
                    } else {
                        // API 逻辑上的失败
                        log::warn!("Token 验证失败: {}", resp.message);
                        Err(resp.message)
                    }
                }
                Err(e) => Err(format!("解析响应失败: {e}")),
            }
        }
        Err(e) => {
            log::error!("请求验证token失败: {e}");
            Err("连接同步服务器失败!".to_string())
        }
    }
}

#[tauri::command]
pub async fn sync_start(
    user: User,
    payload: ClientSyncPayload,
    http_client: State<'_, Client>,
) -> Result<ApiResponse<StartSyncResponse>, String> {
    log::info!("开始同步会话...");
    let url = format!("{}/api/v1/sync/start", user.server_address.unwrap());
    let response = http_client
        .post(url)
        .bearer_auth(user.token.unwrap())
        .json(&payload)
        .send()
        .await;

    match response {
        Ok(res) => res
            .json::<ApiResponse<StartSyncResponse>>()
            .await
            .map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn sync_chunk(
    user: User,
    payload: ClientSyncDataChunk,
    http_client: State<'_, Client>,
) -> Result<ApiResponse<()>, String> {
    log::info!("发送数据块: {:?}", payload.data_type);
    let url = format!("{}/api/v1/sync/chunk", user.server_address.unwrap());
    let response = http_client
        .post(url)
        .bearer_auth(user.token.unwrap())
        .json(&payload)
        .send()
        .await;
    match response {
        Ok(res) => res
            .json::<ApiResponse<()>>()
            .await
            .map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn sync_complete(
    user: User,
    session_id: String,
    http_client: State<'_, Client>,
) -> Result<ApiResponse<ServerSyncData>, String> {
    log::info!("完成同步会话: {}", session_id);
    let url = format!("{}/api/v1/sync/complete", user.server_address.unwrap());
    let response = http_client
        .post(url)
        .bearer_auth(user.token.unwrap())
        .json(&serde_json::json!({ "session_id": session_id }))
        .send()
        .await;

    match response {
        Ok(res) => res
            .json::<ApiResponse<ServerSyncData>>()
            .await
            .map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

/// 从客户端接收一个图标的完整路径，并将其上传到服务器。
#[tauri::command]
pub async fn upload_icon(
    user: User,
    file_path: PathBuf,
    file_name: String,
    http_client: State<'_, Client>,
) -> Result<(), String> {
    log::info!("准备上传图标: {}", file_path.display());

    let server_address = user
        .server_address
        .ok_or_else(|| "服务器地址未配置".to_string())?;
    let token = user.token.ok_or_else(|| "用户认证token丢失".to_string())?;

    let upload_url = format!("{server_address}/api/v1/icons/upload");

    let file_contents = fs::read(&file_path).map_err(|e| format!("读取文件失败: {e}"))?;

    let part = Part::bytes(file_contents).file_name(file_name);
    let form = Form::new().part("icon", part);

    let response = http_client
        .post(&upload_url)
        .bearer_auth(token)
        .timeout(Duration::from_secs(60))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("上传请求失败: {e}"))?;

    if response.status().is_success() {
        log::info!("✅ 图标上传成功: {}", file_path.display());
        Ok(())
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "无法读取错误响应".into());
        Err(format!("服务器返回错误: {error_text}"))
    }
}

/// 从服务器下载指定的图标文件并保存到本地。
#[tauri::command]
pub async fn download_icon(
    app_handle: AppHandle,
    user: User,
    file_name: String,
    http_client: State<'_, Client>,
) -> Result<(), String> {
    log::info!("准备下载图标: {file_name}");

    let server_address = user
        .server_address
        .ok_or_else(|| "服务器地址未配置".to_string())?;
    let token = user.token.ok_or_else(|| "用户认证token丢失".to_string())?;
    let user_uuid = user.uuid;

    let download_url = format!("{server_address}/api/v1/icons/download/{user_uuid}/{file_name}");

    let icons_dir = app_handle
        .path()
        .home_dir()
        .unwrap()
        .join(HOME_VUST_DIR)
        .join(APP_CONFIG_DIR)
        .join("icons");

    if !icons_dir.exists() {
        fs::create_dir_all(&icons_dir).map_err(|e| e.to_string())?;
    }

    let dest_path = icons_dir.join(&file_name);

    let response = http_client
        .get(&download_url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {e}"))?;

    if response.status().is_success() {
        let file_bytes = response.bytes().await.map_err(|e| e.to_string())?;
        let mut file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
        file.write_all(&file_bytes).map_err(|e| e.to_string())?;
        log::info!("✅ 图标下载成功到: {}", dest_path.display());
        Ok(())
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "无法读取错误响应".into());
        Err(format!("服务器返回错误: {error_text}"))
    }
}
