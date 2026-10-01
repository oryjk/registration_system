-- +goose Up
-- 队费账户改为动作制：余额只能由充值/消费扣费/冲正/结算产生，不再支持直接设置。
ALTER TABLE team_members DROP CONSTRAINT team_members_status_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_status_check CHECK (
    status IN ('active', 'inactive', 'left', 'removed')
);

ALTER TABLE team_fund_transactions DROP CONSTRAINT team_fund_transactions_source_check;
ALTER TABLE team_fund_transactions ADD CONSTRAINT team_fund_transactions_source_check CHECK (
    source IN ('membership_payment', 'match_settlement', 'settlement_reversal',
               'admin_credit', 'manual_adjustment', 'manual_consume', 'manual_reversal')
);

-- 操作人可追溯：新人工动作记录操作者，历史行保持 NULL。
ALTER TABLE team_fund_transactions
    ADD COLUMN created_by_user_id BIGINT NULL REFERENCES users(id);

-- 冲正防重：已被冲正的流水不允许再次冲正。
ALTER TABLE team_fund_transactions
    ADD COLUMN reversed_by_transaction_id BIGINT NULL REFERENCES team_fund_transactions(id);

-- +goose Down
-- 回滚前置校验：已产生人工消费/冲正流水或被移除成员时禁止回滚。
-- 删除真实资金流水会导致余额与账目脱节无法对账；如确需回滚，先人工核销这些数据。
-- StatementBegin/End：DO 块内含分号，必须显式包裹，否则 goose 会按分号截断语句。
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM team_fund_transactions WHERE source IN ('manual_consume', 'manual_reversal')) THEN
        RAISE EXCEPTION 'team_fund_transactions 已有人工消费/冲正流水，禁止回滚 00036：删除流水会破坏对账，请先人工核销';
    END IF;
    IF EXISTS (SELECT 1 FROM team_members WHERE status = 'removed') THEN
        RAISE EXCEPTION 'team_members 已有 removed 成员，禁止回滚 00036：收窄状态约束会失败，请先处理这些成员';
    END IF;
END
$$;
-- +goose StatementEnd

ALTER TABLE team_fund_transactions DROP COLUMN reversed_by_transaction_id;
ALTER TABLE team_fund_transactions DROP COLUMN created_by_user_id;
ALTER TABLE team_fund_transactions DROP CONSTRAINT team_fund_transactions_source_check;
ALTER TABLE team_fund_transactions ADD CONSTRAINT team_fund_transactions_source_check CHECK (
    source IN ('membership_payment', 'match_settlement', 'settlement_reversal',
               'admin_credit', 'manual_adjustment')
);

ALTER TABLE team_members DROP CONSTRAINT team_members_status_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_status_check CHECK (
    status IN ('active', 'inactive', 'left')
);
