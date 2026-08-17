-- +goose Up
-- 队费(球队会员)支付:订单标记类型与归属球队;球队侧补会员/信用字段。
ALTER TABLE payment_orders
    ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'recharge',
    ADD COLUMN team_id BIGINT NULL REFERENCES teams(id),
    ADD COLUMN months INT NULL;
ALTER TABLE payment_orders
    ADD CONSTRAINT payment_orders_kind_check CHECK (kind IN ('recharge', 'team_membership')),
    ADD CONSTRAINT payment_orders_membership_shape_check CHECK (
        (kind = 'team_membership' AND team_id IS NOT NULL AND months > 0)
        OR (kind = 'recharge' AND team_id IS NULL AND months IS NULL)
    );

ALTER TABLE teams
    ADD COLUMN credit_score INT NOT NULL DEFAULT 90,
    ADD COLUMN vip_until TIMESTAMPTZ NULL;
ALTER TABLE teams
    ADD CONSTRAINT teams_credit_score_range_check CHECK (credit_score >= 0 AND credit_score <= 100);

-- +goose Down
ALTER TABLE teams
    DROP CONSTRAINT teams_credit_score_range_check,
    DROP COLUMN credit_score,
    DROP COLUMN vip_until;
ALTER TABLE payment_orders
    DROP CONSTRAINT payment_orders_membership_shape_check,
    DROP CONSTRAINT payment_orders_kind_check,
    DROP COLUMN kind,
    DROP COLUMN team_id,
    DROP COLUMN months;
