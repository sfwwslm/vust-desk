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
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE,
    FOREIGN KEY (group_uuid) REFERENCES website_groups (uuid) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS set_websites_updated_at
AFTER UPDATE ON websites FOR EACH ROW
BEGIN
    UPDATE websites SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = OLD.id;
END;