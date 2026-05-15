ALTER TABLE rs_user_info
    ADD COLUMN IF NOT EXISTS is_venue BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE rs_challenges
    ALTER COLUMN host_team_id DROP NOT NULL;

ALTER TABLE rs_challenges
    DROP CONSTRAINT IF EXISTS fk_challenges_host_team;

ALTER TABLE rs_challenges
    ADD CONSTRAINT fk_challenges_host_team
    FOREIGN KEY (host_team_id) REFERENCES rs_teams (id) ON DELETE SET NULL;
