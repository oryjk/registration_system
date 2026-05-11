ALTER TABLE rs_challenges
    ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'team';

UPDATE rs_challenges
SET kind = 'team'
WHERE kind IS NULL OR kind = '';

ALTER TABLE rs_challenges
    DROP CONSTRAINT IF EXISTS ck_challenges_kind;

ALTER TABLE rs_challenges
    ADD CONSTRAINT ck_challenges_kind CHECK (kind IN ('team', 'individual'));

CREATE TABLE IF NOT EXISTS rs_challenge_individual_acceptances (
    id BIGSERIAL PRIMARY KEY,
    challenge_id CHAR(36) NOT NULL REFERENCES rs_challenges (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES rs_user_info (id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_challenge_individual_acceptance UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_individual_acceptances_challenge
    ON rs_challenge_individual_acceptances (challenge_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_challenge_individual_acceptances_user
    ON rs_challenge_individual_acceptances (user_id, created_at DESC);
