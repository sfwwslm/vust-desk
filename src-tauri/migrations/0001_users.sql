CREATE TABLE IF NOT EXISTS users (
    uuid TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    is_logged_in INTEGER NOT NULL DEFAULT 0,
    server_address TEXT,
    server_instance_uuid TEXT,
    token TEXT, 
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

    -- 确保在同一个服务器实例内，用户名是唯一的
    UNIQUE (server_instance_uuid, username) 
);

CREATE TRIGGER IF NOT EXISTS set_users_updated_at
AFTER UPDATE ON users FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE uuid = OLD.uuid;
END;