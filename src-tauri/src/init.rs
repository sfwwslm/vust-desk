use crate::modules::{db, logger, tray};
use crate::utils::{HttpClientConfig, build_http_client};
use log::{error, info};
use tauri::{Manager, Runtime};

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

    info!("【初始化】`setup` 设置完成");
}

pub fn manage(app: &mut tauri::App) {
    let client = build_http_client(HttpClientConfig::builder()).unwrap();
    app.manage(client);

    info!("【初始化】`state` 设置完成")
}
