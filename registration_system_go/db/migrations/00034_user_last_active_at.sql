-- +goose Up
ALTER TABLE users
    ADD COLUMN last_active_at TIMESTAMPTZ NULL;

CREATE INDEX users_last_active_at_idx
    ON users (last_active_at DESC)
    WHERE last_active_at IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS users_last_active_at_idx;

ALTER TABLE users
    DROP COLUMN IF EXISTS last_active_at;
