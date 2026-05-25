ALTER TABLE rs_challenges
    ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) NOT NULL DEFAULT 'postpaid';

UPDATE rs_challenges
SET payment_mode = 'postpaid'
WHERE payment_mode IS NULL OR payment_mode = '';

ALTER TABLE rs_challenges
    DROP CONSTRAINT IF EXISTS ck_challenges_payment_mode;

ALTER TABLE rs_challenges
    ADD CONSTRAINT ck_challenges_payment_mode CHECK (payment_mode IN ('prepaid', 'postpaid'));

ALTER TABLE rs_challenge_individual_acceptances
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS payment_order_no VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS payment_notified_at TIMESTAMP NULL;

UPDATE rs_challenge_individual_acceptances
SET payment_status = 'unpaid'
WHERE payment_status IS NULL OR payment_status = '';

ALTER TABLE rs_challenge_individual_acceptances
    DROP CONSTRAINT IF EXISTS ck_challenge_individual_acceptances_payment_status;

ALTER TABLE rs_challenge_individual_acceptances
    ADD CONSTRAINT ck_challenge_individual_acceptances_payment_status
        CHECK (payment_status IN ('unpaid', 'paid', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_challenge_individual_acceptances_payment_deadline
    ON rs_challenge_individual_acceptances (payment_status, payment_deadline_at)
    WHERE payment_deadline_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_challenge_individual_acceptances_payment_order
    ON rs_challenge_individual_acceptances (payment_order_no)
    WHERE payment_order_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_challenge_individual_acceptances_postpaid_notify
    ON rs_challenge_individual_acceptances (payment_status, payment_notified_at)
    WHERE payment_status = 'unpaid';
