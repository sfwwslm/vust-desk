use crate::modules::{db, logger, tray};
use crate::utils::{HttpClientConfig, build_http_client};
use log::{error, info};
use tauri::{Manager, Runtime};
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

pub trait CustomInit {
    fn init_plugin(self) -> Self;
}

impl<R: Runtime> CustomInit for tauri::Builder<R> {
    fn init_plugin(self) -> Self {
        self
    }
}

pub fn setup(app: &mut tauri::App) {
    if let Err(e) = tray::create(app) {
        error!("Failed to create system tray: {e}");
    }

    tray::listener(app);

    if let Err(e) = logger::init(app) {
        error!("Failed to initialize logging: {e}");
    }

    if let Err(e) = db::migrations(app) {
        error!("Failed to initialize database: {e}");
    }

    #[cfg(desktop)]
    {
        app.handle()
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcuts(["ctrl+shift+x"])
                    .unwrap()
                    .with_handler(|app, shortcut, event| {
                        if event.state == ShortcutState::Pressed
                            && shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyX)
                            && let Some(window) = app.get_webview_window("main")
                        {
                            let is_visible = window.is_visible().unwrap();
                            let is_minimized = window.is_minimized().unwrap();

                            if !is_visible {
                                // 窗口是隐藏的 → 显示并聚焦
                                window.show().unwrap();
                                window.unminimize().unwrap();
                                window.set_focus().unwrap();
                            } else if is_minimized {
                                // 窗口最小化 → 恢复显示
                                window.unminimize().unwrap();
                                window.set_focus().unwrap();
                            } else {
                                // 窗口正常显示 → 隐藏
                                window.hide().unwrap();
                            }
                        };
                    })
                    .build(),
            )
            .unwrap();
    }

    info!("【初始化】`setup` 设置完成");
}

pub fn manage(app: &mut tauri::App) {
    let client = build_http_client(HttpClientConfig::builder()).unwrap();
    app.manage(client);

    info!("【初始化】`state` 设置完成")
}
