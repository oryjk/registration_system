-- +goose Up
-- 队员级付费会员：与“是否属于球队”分离；余额仍沿用 team_members.balance_cents。
ALTER TABLE team_members
    ADD COLUMN is_paid_member BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN last_recharge_at TIMESTAMPTZ NULL;

-- 对已有可确认的队费入账做兼容回填；只有历史余额但缺少流水时保留充值时间为空。
UPDATE team_members tm
SET is_paid_member = TRUE,
    last_recharge_at = (
        SELECT MAX(tft.created_at)
        FROM team_fund_transactions tft
        WHERE tft.team_id = tm.team_id
          AND tft.user_id = tm.user_id
          AND tft.source IN ('membership_payment', 'admin_credit')
    )
WHERE tm.balance_cents > 0
   OR EXISTS (
        SELECT 1
        FROM team_fund_transactions tft
        WHERE tft.team_id = tm.team_id
          AND tft.user_id = tm.user_id
          AND tft.source IN ('membership_payment', 'admin_credit')
   );

-- 管理员/队长可以直接校准“当前余额”；差额必须记流水，避免账本与余额静默分叉。
ALTER TABLE team_fund_transactions
    DROP CONSTRAINT team_fund_transactions_source_check,
    ADD CONSTRAINT team_fund_transactions_source_check CHECK (
        source IN ('membership_payment', 'match_settlement', 'settlement_reversal', 'admin_credit', 'manual_adjustment')
    );

-- +goose Down
-- 回滚时把新增的手工校准流水归类为旧版可识别的 admin_credit，保留金额与余额快照。
UPDATE team_fund_transactions
SET source = 'admin_credit'
WHERE source = 'manual_adjustment';

ALTER TABLE team_fund_transactions
    DROP CONSTRAINT team_fund_transactions_source_check,
    ADD CONSTRAINT team_fund_transactions_source_check CHECK (
        source IN ('membership_payment', 'match_settlement', 'settlement_reversal', 'admin_credit')
    );

ALTER TABLE team_members
    DROP COLUMN last_recharge_at,
    DROP COLUMN is_paid_member;
