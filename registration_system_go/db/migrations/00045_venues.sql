-- +goose Up
-- Venue profiles are additive; matches retain their historical location snapshots.
CREATE TABLE venues (
    name text PRIMARY KEY,
    image_url text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE venues;
