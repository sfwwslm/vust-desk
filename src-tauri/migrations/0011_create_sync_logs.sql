-- 记录客户端本地的同步历史，便于事后排查
CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    user_uuid TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running', -- running/success/failed
    summary TEXT,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON sync_logs(user_uuid, started_at DESC);
