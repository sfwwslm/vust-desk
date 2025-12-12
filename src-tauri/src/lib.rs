pub mod init;
pub mod invokes;
pub mod modules;
pub mod types;
pub mod utils;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 默认情况下，当应用程序已经在运行时启动新实例时，不会采取任何操作。当用户尝试打开一个新实例时，为了聚焦正在运行实例的窗口，修改回调闭包如下。
            let windows = app.webview_windows();
            windows
                .values()
                .next()
                .expect("Sorry, no window found")
                .set_focus()
                .expect("Can't Bring Window to Focus");
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            init::setup(app);
            init::manage(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            invokes::metadata::fetch_website_metadata,
            invokes::metadata::save_uploaded_icon,
            invokes::bookmark_parser::bookmark_parser,
            invokes::sync::check_token_and_user,
            invokes::sync::check_client_version,
            invokes::sync::check_server_version,
            invokes::sync::sync_start,
            invokes::sync::sync_chunk,
            invokes::sync::sync_complete,
            invokes::sync::upload_icon,
            invokes::sync::download_icon,
            invokes::browser::detect_installed_browsers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
