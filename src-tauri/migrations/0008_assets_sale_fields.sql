-- 为资产表补充卖出相关字段与索引（本地数据库）。
ALTER TABLE assets ADD COLUMN status TEXT NOT NULL DEFAULT 'holding';
ALTER TABLE assets ADD COLUMN sale_price REAL;
ALTER TABLE assets ADD COLUMN sale_date TEXT;
ALTER TABLE assets ADD COLUMN fees REAL DEFAULT 0;
ALTER TABLE assets ADD COLUMN buyer TEXT;
ALTER TABLE assets ADD COLUMN notes TEXT;
ALTER TABLE assets ADD COLUMN realized_profit REAL;

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets (status);
CREATE INDEX IF NOT EXISTS idx_assets_sale_date ON assets (sale_date);
