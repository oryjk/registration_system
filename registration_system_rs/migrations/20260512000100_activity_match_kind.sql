ALTER TABLE rs_activity
    ADD COLUMN IF NOT EXISTS match_kind VARCHAR(16) NOT NULL DEFAULT 'external';

UPDATE rs_activity
SET match_kind = 'external'
WHERE match_kind IS NULL OR match_kind NOT IN ('external', 'internal');
