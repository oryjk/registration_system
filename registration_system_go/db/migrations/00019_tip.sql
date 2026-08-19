-- +goose Up
-- 打赏（请开发者喝咖啡）：新增 tip 订单类型与 tips 快照表。
-- 功能建议随下单落库（pending），支付回调核销后置 submitted（已生效）；
-- 订单取消/失败时 tips 行停留在 pending 属预期，无需清理。

ALTER TABLE payment_orders
    DROP CONSTRAINT payment_orders_kind_check,
    ADD CONSTRAINT payment_orders_kind_check CHECK (
        kind IN ('recharge', 'team_membership', 'match_registration', 'tip')
    );

CREATE TABLE tips (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(32) NOT NULL UNIQUE REFERENCES payment_orders(order_no),
    user_id BIGINT NOT NULL REFERENCES users(id),
    nickname VARCHAR(120) NOT NULL DEFAULT '',
    amount_cents BIGINT NOT NULL,
    suggestion TEXT NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ NULL,
    CONSTRAINT tips_status_check CHECK (status IN ('pending', 'submitted')),
    CONSTRAINT tips_amount_positive CHECK (amount_cents > 0),
    CONSTRAINT tips_order_no_not_blank CHECK (BTRIM(order_no) <> '')
);

-- 管理端"打赏与建议"列表按提交时间倒序，只取已生效记录。
CREATE INDEX tips_submitted_listing_idx ON tips (status, submitted_at DESC, id DESC);

-- +goose Down
DROP TABLE IF EXISTS tips;
ALTER TABLE payment_orders
    DROP CONSTRAINT payment_orders_kind_check,
    ADD CONSTRAINT payment_orders_kind_check CHECK (
        kind IN ('recharge', 'team_membership', 'match_registration')
    );
