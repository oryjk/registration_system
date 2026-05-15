CREATE INDEX IF NOT EXISTS idx_recharge_records_user_created_at
    ON rs_recharge_records (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_billings_user_created_at
    ON rs_user_billings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_penalties_user_created_at
    ON rs_monthly_penalties (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_balance_adjustments_user_effective_created
    ON rs_user_balance_adjustments (user_id, effective_time ASC, created_at ASC);
