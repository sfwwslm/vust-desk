-- 为 users 表添加 refresh_token 列
ALTER TABLE users ADD COLUMN refresh_token TEXT;
