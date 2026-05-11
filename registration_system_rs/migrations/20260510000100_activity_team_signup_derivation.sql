ALTER TABLE rs_activity
    ADD COLUMN IF NOT EXISTS source_activity_id CHAR(36) NULL,
    ADD COLUMN IF NOT EXISTS team_registration_count INT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_activity_source_activity'
    ) THEN
        ALTER TABLE rs_activity
            ADD CONSTRAINT fk_activity_source_activity
            FOREIGN KEY (source_activity_id)
            REFERENCES rs_activity (id)
            ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_source_activity_id
    ON rs_activity (source_activity_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_activity_source_team
    ON rs_activity (source_activity_id, home_team_id)
    WHERE source_activity_id IS NOT NULL AND home_team_id IS NOT NULL;
