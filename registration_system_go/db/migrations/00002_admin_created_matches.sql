-- +goose Up
ALTER TABLE matches
    ALTER COLUMN created_by_user_id DROP NOT NULL,
    ADD COLUMN created_by_admin_id BIGINT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT matches_creator_check CHECK (
        (created_by_user_id IS NOT NULL AND created_by_admin_id IS NULL)
        OR (created_by_user_id IS NULL AND created_by_admin_id IS NOT NULL)
    );

CREATE INDEX matches_created_by_admin_idx
    ON matches (created_by_admin_id, created_at DESC)
    WHERE created_by_admin_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS matches_created_by_admin_idx;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_creator_check;
ALTER TABLE matches DROP COLUMN IF EXISTS created_by_admin_id;
ALTER TABLE matches ALTER COLUMN created_by_user_id SET NOT NULL;
