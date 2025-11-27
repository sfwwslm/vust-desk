CREATE TABLE IF NOT EXISTS asset_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    user_uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE
);

-- 创建局部唯一索引，确保同一个用户不能创建同名的、未被删除的分类
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_category_name
ON asset_categories (user_uuid, name)
WHERE is_deleted = 0;

-- ✨ 创建唯一索引，确保每个用户只有一个 is_default = 1 的分类
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_default_category_per_user
ON asset_categories (user_uuid)
WHERE is_default = 1;

-- 更新时间戳触发器
CREATE TRIGGER IF NOT EXISTS set_asset_categories_updated_at
AFTER UPDATE ON asset_categories FOR EACH ROW
BEGIN
    UPDATE asset_categories SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = OLD.id;
END;