-- +goose Up
ALTER TABLE matches DROP CONSTRAINT matches_fee_type_check;
ALTER TABLE matches ADD CONSTRAINT matches_fee_type_check CHECK (fee_type IN ('', 'offline_aa', 'free', 'fixed_amount', 'team_fund'));

-- +goose Down
-- Existing team_fund rows intentionally prevent rollback instead of discarding their meaning.
ALTER TABLE matches DROP CONSTRAINT matches_fee_type_check;
ALTER TABLE matches ADD CONSTRAINT matches_fee_type_check CHECK (fee_type IN ('', 'offline_aa', 'free', 'fixed_amount'));
