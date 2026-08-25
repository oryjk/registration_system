-- +goose Up
-- 管理员手动充值队费：线下收款入账，无支付订单。
ALTER TABLE team_fund_transactions
    DROP CONSTRAINT team_fund_transactions_source_check,
    ADD CONSTRAINT team_fund_transactions_source_check CHECK (
        source IN ('membership_payment', 'match_settlement', 'settlement_reversal', 'admin_credit')
    );

-- +goose Down
ALTER TABLE team_fund_transactions
    DROP CONSTRAINT team_fund_transactions_source_check,
    ADD CONSTRAINT team_fund_transactions_source_check CHECK (
        source IN ('membership_payment', 'match_settlement', 'settlement_reversal')
    );
