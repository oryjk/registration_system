CREATE TABLE IF NOT EXISTS rs_activity_settlement_batches (
    id BIGSERIAL PRIMARY KEY,
    activity_id CHAR(36) NOT NULL,
    batch_no INT NOT NULL,
    operation_type VARCHAR(16) NOT NULL,
    reversal_of_batch_id BIGINT NULL,
    description VARCHAR(500) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    aa_fee DECIMAL(10, 2) NOT NULL,
    user_count INT NOT NULL,
    created_by_admin_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_activity_settlement_batch UNIQUE (activity_id, batch_no),
    CONSTRAINT fk_activity_settlement_batch_activity FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_settlement_batch_reverse FOREIGN KEY (reversal_of_batch_id) REFERENCES rs_activity_settlement_batches (id),
    CONSTRAINT fk_activity_settlement_batch_admin FOREIGN KEY (created_by_admin_id) REFERENCES rs_admin_user (id)
);

CREATE INDEX IF NOT EXISTS idx_activity_settlement_batches_activity
    ON rs_activity_settlement_batches (activity_id, batch_no DESC);
CREATE INDEX IF NOT EXISTS idx_activity_settlement_batches_reversal
    ON rs_activity_settlement_batches (reversal_of_batch_id);

ALTER TABLE rs_user_billings
    ADD COLUMN IF NOT EXISTS settlement_batch_id BIGINT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_billings_settlement_batch'
    ) THEN
        ALTER TABLE rs_user_billings
            ADD CONSTRAINT fk_user_billings_settlement_batch
            FOREIGN KEY (settlement_batch_id) REFERENCES rs_activity_settlement_batches (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_billings_settlement_batch
    ON rs_user_billings (settlement_batch_id);
