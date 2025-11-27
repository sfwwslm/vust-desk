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
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_uuid) REFERENCES users (uuid) ON DELETE CASCADE,
    FOREIGN KEY (category_uuid) REFERENCES asset_categories (uuid) ON DELETE RESTRICT
);

CREATE TRIGGER IF NOT EXISTS set_assets_updated_at
AFTER UPDATE ON assets FOR EACH ROW
BEGIN
    UPDATE assets SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = OLD.id;
END;