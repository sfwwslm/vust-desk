CREATE TABLE IF NOT EXISTS sync_metadata (
    user_uuid TEXT PRIMARY KEY NOT NULL,
    last_synced_at TEXT,
    device_id TEXT, -- 可选，为未来扩展，记录设备ID
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE
);