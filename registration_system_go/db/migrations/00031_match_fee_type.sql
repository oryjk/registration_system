-- +goose Up
ALTER TABLE matches ADD COLUMN fee_type TEXT NOT NULL DEFAULT ''
 CHECK (fee_type IN ('', 'offline_aa', 'free', 'fixed_amount'));

-- +goose Down
ALTER TABLE matches DROP COLUMN fee_type;
