-- 为本地 SQLite 增加服务器修订号 rev，并记录最近同步的 rev，用于增量同步。

-- 网站分组
ALTER TABLE website_groups ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
UPDATE website_groups SET rev = (CAST(strftime('%s','now') AS INTEGER) * 1000) WHERE rev IS NULL OR rev = 0;
DROP TRIGGER IF EXISTS set_website_groups_updated_at;
CREATE TRIGGER IF NOT EXISTS set_website_groups_updated_at
AFTER UPDATE ON website_groups FOR EACH ROW
BEGIN
    UPDATE website_groups
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 网站
ALTER TABLE websites ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
UPDATE websites SET rev = (CAST(strftime('%s','now') AS INTEGER) * 1000) WHERE rev IS NULL OR rev = 0;
DROP TRIGGER IF EXISTS set_websites_updated_at;
CREATE TRIGGER IF NOT EXISTS set_websites_updated_at
AFTER UPDATE ON websites FOR EACH ROW
BEGIN
    UPDATE websites
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 资产分类
ALTER TABLE asset_categories ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
UPDATE asset_categories SET rev = (CAST(strftime('%s','now') AS INTEGER) * 1000) WHERE rev IS NULL OR rev = 0;
DROP TRIGGER IF EXISTS set_asset_categories_updated_at;
CREATE TRIGGER IF NOT EXISTS set_asset_categories_updated_at
AFTER UPDATE ON asset_categories FOR EACH ROW
BEGIN
    UPDATE asset_categories
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 资产
ALTER TABLE assets ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
UPDATE assets SET rev = (CAST(strftime('%s','now') AS INTEGER) * 1000) WHERE rev IS NULL OR rev = 0;
DROP TRIGGER IF EXISTS set_assets_updated_at;
CREATE TRIGGER IF NOT EXISTS set_assets_updated_at
AFTER UPDATE ON assets FOR EACH ROW
BEGIN
    UPDATE assets
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 搜索引擎
ALTER TABLE search_engines ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
UPDATE search_engines SET rev = (CAST(strftime('%s','now') AS INTEGER) * 1000) WHERE rev IS NULL OR rev = 0;
DROP TRIGGER IF EXISTS set_search_engines_updated_at;
CREATE TRIGGER IF NOT EXISTS set_search_engines_updated_at
AFTER UPDATE ON search_engines FOR EACH ROW
BEGIN
    UPDATE search_engines
    SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        rev = (CAST(strftime('%s','now') AS INTEGER) * 1000)
    WHERE id = OLD.id;
END;

-- 同步元数据，增加 last_synced_rev
ALTER TABLE sync_metadata ADD COLUMN last_synced_rev INTEGER NOT NULL DEFAULT 0;
UPDATE sync_metadata SET last_synced_rev = 0 WHERE last_synced_rev IS NULL;
