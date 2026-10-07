-- +goose Up
-- Additive table; existing deployed backend does not query it.
CREATE TABLE team_honor_shares (
    id uuid PRIMARY KEY,
    team_id bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_year integer NOT NULL CHECK (score_year BETWEEN 2000 AND 9999),
    created_at timestamp NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    UNIQUE (team_id, user_id, score_year)
);

-- +goose Down
DROP TABLE team_honor_shares;
