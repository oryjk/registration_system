-- +goose Up
-- 散人约球（online_pickup）：所有参与者都是散人、无球队概念的全新发布模式；
-- 同时为比赛补齐报名支付方式与人均费用，支撑赛前/赛后支付。

ALTER TABLE matches
    DROP CONSTRAINT matches_publication_mode_check,
    ADD CONSTRAINT matches_publication_mode_check CHECK (
        publication_mode IN ('offline_confirmed', 'online_team', 'online_individual', 'online_pickup')
    );

-- 仅散人约球允许（且必须）无主队；其余模式沿用必填语义。
ALTER TABLE matches ALTER COLUMN host_team_id DROP NOT NULL;
ALTER TABLE matches
    ADD CONSTRAINT matches_host_team_presence_check CHECK (
        (publication_mode = 'online_pickup' AND host_team_id IS NULL)
        OR (publication_mode <> 'online_pickup' AND host_team_id IS NOT NULL)
    );

ALTER TABLE matches
    ADD COLUMN payment_mode VARCHAR(16) NOT NULL DEFAULT 'postpaid',
    ADD COLUMN fee_per_person_cents BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT matches_payment_mode_check CHECK (payment_mode IN ('postpaid', 'prepaid')),
    ADD CONSTRAINT matches_fee_non_negative_check CHECK (fee_per_person_cents >= 0);

-- 报名记录的支付标记：赛前支付订单核销后置 true。
ALTER TABLE match_registrations
    ADD COLUMN paid BOOLEAN NOT NULL DEFAULT FALSE;

-- 比赛报名费订单：金额取自比赛定价（服务端），通过 match_id 关联。
ALTER TABLE payment_orders
    DROP CONSTRAINT payment_orders_kind_check,
    ADD CONSTRAINT payment_orders_kind_check CHECK (
        kind IN ('recharge', 'team_membership', 'match_registration')
    ),
    ADD COLUMN match_id UUID NULL REFERENCES matches(id),
    ADD CONSTRAINT payment_orders_match_shape_check CHECK (
        (kind = 'match_registration' AND match_id IS NOT NULL AND team_id IS NULL)
        OR (kind <> 'match_registration' AND match_id IS NULL)
    );

-- +goose Down
-- 注意：回滚前需先清理散人约球比赛及其报名/订单数据，否则 host_team_id 恢复
-- NOT NULL 与三值 publication_mode 约束会因残留数据失败。
ALTER TABLE payment_orders
    DROP CONSTRAINT payment_orders_match_shape_check,
    DROP COLUMN match_id,
    DROP CONSTRAINT payment_orders_kind_check,
    ADD CONSTRAINT payment_orders_kind_check CHECK (kind IN ('recharge', 'team_membership'));

ALTER TABLE match_registrations DROP COLUMN paid;

ALTER TABLE matches
    DROP CONSTRAINT matches_fee_non_negative_check,
    DROP CONSTRAINT matches_payment_mode_check,
    DROP COLUMN fee_per_person_cents,
    DROP COLUMN payment_mode,
    DROP CONSTRAINT matches_host_team_presence_check;
ALTER TABLE matches ALTER COLUMN host_team_id SET NOT NULL;
ALTER TABLE matches
    DROP CONSTRAINT matches_publication_mode_check,
    ADD CONSTRAINT matches_publication_mode_check CHECK (
        publication_mode IN ('offline_confirmed', 'online_team', 'online_individual')
    );
