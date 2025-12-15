-- 为 search_engines 表增加软删除标记，保持与服务端 schema 对齐
ALTER TABLE search_engines ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;
UPDATE search_engines SET is_deleted = 0 WHERE is_deleted IS NULL;
