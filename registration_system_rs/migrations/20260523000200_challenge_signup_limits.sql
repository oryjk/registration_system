ALTER TABLE rs_challenges
    ADD COLUMN IF NOT EXISTS min_players INT NULL,
    ADD COLUMN IF NOT EXISTS max_players INT NULL;

ALTER TABLE rs_challenges
    DROP CONSTRAINT IF EXISTS ck_challenges_signup_limits;

ALTER TABLE rs_challenges
    ADD CONSTRAINT ck_challenges_signup_limits CHECK (
        (min_players IS NULL OR min_players > 0)
        AND (max_players IS NULL OR max_players > 0)
        AND (
            min_players IS NULL
            OR max_players IS NULL
            OR min_players <= max_players
        )
    );
