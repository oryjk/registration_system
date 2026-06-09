ALTER TABLE rs_activity
    ADD COLUMN IF NOT EXISTS team_capacity_limit INT NULL;

ALTER TABLE rs_activity
    DROP CONSTRAINT IF EXISTS ck_activity_team_capacity_limit;

ALTER TABLE rs_activity
    ADD CONSTRAINT ck_activity_team_capacity_limit CHECK (
        team_capacity_limit IS NULL OR team_capacity_limit > 0
    );
