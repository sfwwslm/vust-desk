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
    vec![
        Migration {
            version: 1,
            description: "create_users_table",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0001_users.sql"),
        },
        Migration {
            version: 2,
            description: "create_sync_metadata_table",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0002_sync_metadata.sql"),
        },
        Migration {
            version: 3,
            description: "create_website_groups_table",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0003_website_groups.sql"),
        },
        Migration {
            version: 4,
            description: "create_websites_table",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0004_websites.sql"),
        },
        Migration {
            version: 5,
            description: "create_asset_categories_table",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0005_asset_categories.sql"),
        },
        Migration {
            version: 6,
            description: "create_assets_table",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0006_assets.sql"),
        },
        Migration {
            version: 7,
            description: "create_search_engines",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0007_create_search_engines.sql"),
        },
        Migration {
            version: 8,
            description: "add_asset_sale_fields",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0008_assets_sale_fields.sql"),
        },
        Migration {
            version: 9,
            description: "add_rev_and_sync_rev",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0009_add_rev_and_sync_rev.sql"),
        },
        Migration {
            version: 10,
            description: "add_is_deleted_to_search_engines",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0010_add_is_deleted_to_search_engines.sql"),
        },
        Migration {
            version: 11,
            description: "create_sync_logs",
            kind: MigrationKind::Up,
            sql: include_str!("../../migrations/0011_create_sync_logs.sql"),
        },
    ]
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
