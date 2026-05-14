ALTER TABLE rs_activity_settlement_batches
    ADD COLUMN IF NOT EXISTS settlement_mode VARCHAR(16) NOT NULL DEFAULT 'aa',
    ADD COLUMN IF NOT EXISTS participant_scope VARCHAR(32) NOT NULL DEFAULT 'registered_attendees';
