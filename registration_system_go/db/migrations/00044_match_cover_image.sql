-- +goose Up
-- Additive: old sqlc queries enumerate columns and old inserts use explicit columns.
-- Empty means use the shared client default; legacy/imported matches inherit it.
ALTER TABLE matches ADD COLUMN cover_image_url text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE matches DROP COLUMN cover_image_url;
