use crate::utils::app_data_dir_path;
use std::fmt;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg(debug_assertions)]
const DATABASE_FILE: &str = "dev.db"; // 开发环境 (tauri dev)

#[cfg(not(debug_assertions))]
const DATABASE_FILE: &str = "prod.db"; // 生产环境 (tauri build)

#[derive(Debug, Clone, Copy)]
pub enum TableName {
    Users,
    WebsiteGroups,
    WebsiteItems,
    AssetCategories,
    Assets,
}

impl fmt::Display for TableName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            TableName::Users => "users",
            TableName::WebsiteGroups => "website_groups",
            TableName::WebsiteItems => "websites",
            TableName::AssetCategories => "asset_categories",
            TableName::Assets => "assets",
        };
        write!(f, "{s}")
    }
}

/// 数据库文件或数据库url
fn db_url(app: &tauri::App) -> String {
    // 在 `tauri build --debug` 模式下前端是开发环境后端是生成环境需要注意
    let db_file = app_data_dir_path(app).join(DATABASE_FILE);

    let db_connection_string = format!(
        "sqlite:{}",
        db_file.to_str().expect("数据库文件路径转 str 失败")
    );
    db_connection_string
}

/// 获取所有数据库迁移脚本
fn all_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "baseline_schema",
        kind: MigrationKind::Up,
        sql: include_str!("../../migrations/0001_baseline.sql"),
    }]
}

/// 初始化数据库并应用所有迁移
pub fn migrations(app: &tauri::App) -> tauri::Result<()> {
    let migrations = all_migrations();

    let db_plugin = tauri_plugin_sql::Builder::default()
        .add_migrations(&db_url(app), migrations)
        .build();

    app.handle().plugin(db_plugin).unwrap();
    Ok(())
}
