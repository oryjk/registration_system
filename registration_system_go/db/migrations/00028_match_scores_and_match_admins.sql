-- +goose Up
-- 比赛比分：比赛进行中/结束后由管理端或比赛管理员录入；NULL 表示尚未录入。
ALTER TABLE matches
    ADD COLUMN host_score INTEGER NULL CHECK (host_score BETWEEN 0 AND 999),
    ADD COLUMN away_score INTEGER NULL CHECK (away_score BETWEEN 0 AND 999);

-- 比赛管理员：管理端可把任意微信用户设为比赛管理员，被设置的用户可在小程序端录入比赛比分。
ALTER TABLE users
    ADD COLUMN is_match_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX users_match_admin_idx ON users (is_match_admin) WHERE is_match_admin;

-- +goose Down
DROP INDEX IF EXISTS users_match_admin_idx;
ALTER TABLE users DROP COLUMN IF EXISTS is_match_admin;
ALTER TABLE matches
    DROP COLUMN IF EXISTS away_score,
    DROP COLUMN IF EXISTS host_score;
