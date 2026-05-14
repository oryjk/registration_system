ALTER TABLE rs_user_billings
    ALTER COLUMN billing_type SET DEFAULT 'activity_fee';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rs_user_monthly_balance'
          AND column_name = 'game_fee_amount'
    ) THEN
        ALTER TABLE rs_user_monthly_balance
            RENAME COLUMN game_fee_amount TO activity_fee_amount;
    END IF;
END $$;

TRUNCATE TABLE
    rs_team_membership_orders,
    rs_payment_orders,
    rs_team_fund_transactions,
    rs_user_billings,
    rs_activity_settlement_batches,
    rs_activity_order,
    rs_recharge_records,
    rs_monthly_penalties,
    rs_user_balance_adjustments,
    rs_user_monthly_balance
RESTART IDENTITY CASCADE;

UPDATE rs_user_accounts
SET balance = 0.00,
    total_recharge = 0.00,
    total_expense = 0.00,
    total_penalty = 0.00,
    last_updated = NOW(),
    updated_at = NOW();

UPDATE rs_team_fund_account
SET balance = 0.00,
    total_income = 0.00,
    total_expense = 0.00,
    last_updated = NOW(),
    updated_at = NOW();

UPDATE rs_user_billings
SET billing_type = CASE
    WHEN billing_type = 'game_fee' THEN 'activity_fee'
    WHEN billing_type = 'game_fee_reversal' THEN 'activity_fee_reversal'
    ELSE billing_type
END
WHERE billing_type IN ('game_fee', 'game_fee_reversal');
