-- 该表用于存储用户自定义的搜索引擎
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
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE,
    -- 确保同一用户不能拥有同名的搜索引擎
    UNIQUE(user_uuid, name)
);

CREATE TRIGGER IF NOT EXISTS set_search_engines_updated_at
AFTER UPDATE ON search_engines FOR EACH ROW
BEGIN
    UPDATE search_engines SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = OLD.id;
END;

-- 确保每个用户只能有一个默认搜索引擎
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_default_search_engine_per_user
ON search_engines (user_uuid)
WHERE is_default = 1;