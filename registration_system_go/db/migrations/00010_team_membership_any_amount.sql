-- +goose Up
-- 队费与时间解耦:新队费订单不再记录月数(months 写 NULL)。
-- 原"订单形状"CHECK 的口径（队费=按月续费）已不成立，直接删除该约束。
ALTER TABLE payment_orders
    DROP CONSTRAINT payment_orders_membership_shape_check;

-- +goose Down
ALTER TABLE payment_orders
    ADD CONSTRAINT payment_orders_membership_shape_check CHECK (
        (kind = 'team_membership' AND team_id IS NOT NULL AND months > 0)
        OR (kind = 'recharge' AND team_id IS NULL AND months IS NULL)
    );
