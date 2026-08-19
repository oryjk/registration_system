-- +goose Up
-- 00017 允许 kind = 'match_registration'（18 字符），但 00009 建的列是 VARCHAR(16)，
-- 插入报名费订单会直接 SQLSTATE 22001 超长。扩列宽到 32。
ALTER TABLE payment_orders ALTER COLUMN kind TYPE VARCHAR(32);

-- +goose Down
ALTER TABLE payment_orders ALTER COLUMN kind TYPE VARCHAR(16);
