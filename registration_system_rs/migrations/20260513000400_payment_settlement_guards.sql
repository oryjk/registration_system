ALTER TABLE rs_recharge_records
    ADD COLUMN IF NOT EXISTS payment_order_no VARCHAR(64) NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'rs_recharge_records'
          AND constraint_name = 'fk_recharge_records_payment_order_no'
    ) THEN
        ALTER TABLE rs_recharge_records
            ADD CONSTRAINT fk_recharge_records_payment_order_no
                FOREIGN KEY (payment_order_no)
                REFERENCES rs_payment_orders (order_no)
                ON DELETE SET NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_recharge_records_payment_order_no
    ON rs_recharge_records (payment_order_no);

CREATE UNIQUE INDEX IF NOT EXISTS uk_team_membership_orders_transaction_id
    ON rs_team_membership_orders (transaction_id);
