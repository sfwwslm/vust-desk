-- 用户登录与令牌缓存
CREATE TABLE IF NOT EXISTS users (
    uuid TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    is_logged_in INTEGER NOT NULL DEFAULT 0,
    server_address TEXT,
    server_instance_uuid TEXT,
    token TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (server_instance_uuid, username)
);

CREATE TRIGGER IF NOT EXISTS set_users_updated_at
AFTER UPDATE ON users FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE uuid = OLD.uuid;
END;

-- 同步元数据
CREATE TABLE IF NOT EXISTS sync_metadata (
    user_uuid TEXT PRIMARY KEY NOT NULL,
    last_synced_at TEXT,
    device_id TEXT,
    last_synced_rev INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE
);

-- 资产分类
CREATE TABLE IF NOT EXISTS asset_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    user_uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    rev INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_category_name
ON asset_categories (user_uuid, name)
WHERE is_deleted = 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_default_category_per_user
ON asset_categories (user_uuid)
WHERE is_default = 1;

CREATE TRIGGER IF NOT EXISTS set_asset_categories_updated_at
AFTER UPDATE ON asset_categories FOR EACH ROW
BEGIN
    UPDATE asset_categories
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 资产
CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    user_uuid TEXT NOT NULL,
    category_uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    price REAL NOT NULL,
    expiration_date TEXT,
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'holding',
    sale_price REAL,
    sale_date TEXT,
    fees REAL DEFAULT 0,
    buyer TEXT,
    notes TEXT,
    realized_profit REAL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    rev INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE,
    FOREIGN KEY (category_uuid) REFERENCES asset_categories (uuid) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets (status);
CREATE INDEX IF NOT EXISTS idx_assets_sale_date ON assets (sale_date);

CREATE TRIGGER IF NOT EXISTS set_assets_updated_at
AFTER UPDATE ON assets FOR EACH ROW
BEGIN
    UPDATE assets
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 网站分组
CREATE TABLE IF NOT EXISTS website_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    user_uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    rev INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS set_website_groups_updated_at
AFTER UPDATE ON website_groups FOR EACH ROW
BEGIN
    UPDATE website_groups
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 网站
CREATE TABLE IF NOT EXISTS websites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    user_uuid TEXT NOT NULL,
    group_uuid TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    url_lan TEXT,
    default_icon TEXT,
    local_icon_path TEXT,
    icon_source TEXT,
    description TEXT,
    background_color TEXT,
    sort_order INTEGER,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    rev INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE,
    FOREIGN KEY (group_uuid) REFERENCES website_groups (uuid) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS set_websites_updated_at
AFTER UPDATE ON websites FOR EACH ROW
BEGIN
    UPDATE websites
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 搜索引擎
CREATE TABLE IF NOT EXISTS search_engines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    user_uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    url_template TEXT NOT NULL,
    default_icon TEXT,
    local_icon_path TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    rev INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE,
    UNIQUE(user_uuid, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_default_search_engine_per_user
ON search_engines (user_uuid)
WHERE is_default = 1;

CREATE TRIGGER IF NOT EXISTS set_search_engines_updated_at
AFTER UPDATE ON search_engines FOR EACH ROW
BEGIN
    UPDATE search_engines
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 同步日志
CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    user_uuid TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    summary TEXT,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON sync_logs(user_uuid, started_at DESC);
