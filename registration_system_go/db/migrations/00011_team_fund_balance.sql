-- +goose Up
-- 队费入球队余额：支付成功后金额计入归属球队的 balance_cents。
ALTER TABLE teams
    ADD COLUMN balance_cents BIGINT NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE teams
    DROP COLUMN balance_cents;
