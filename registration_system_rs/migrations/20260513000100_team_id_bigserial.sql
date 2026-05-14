-- Convert team identifiers from CHAR(36) strings to database-generated BIGINT IDs.
-- Existing billing/order data is known to be wrong in the current development data set,
-- so these tables are intentionally cleared before rebuilding stricter constraints.

TRUNCATE TABLE
    rs_team_membership_orders,
    rs_user_billings,
    rs_activity_settlement_batches,
    rs_activity_order,
    rs_recharge_records,
    rs_monthly_penalties,
    rs_user_balance_adjustments,
    rs_user_monthly_balance,
    rs_team_fund_transactions,
    rs_payment_orders
RESTART IDENTITY;

ALTER TABLE rs_teams
    ADD COLUMN IF NOT EXISTS legacy_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS new_numeric_id BIGINT;

UPDATE rs_teams
SET legacy_id = id
WHERE legacy_id IS NULL;

WITH numbered AS (
    SELECT id AS old_id,
           ROW_NUMBER() OVER (ORDER BY created_at, id)::BIGINT AS numeric_id
    FROM rs_teams
)
UPDATE rs_teams t
SET new_numeric_id = numbered.numeric_id
FROM numbered
WHERE t.id = numbered.old_id
  AND t.new_numeric_id IS NULL;

CREATE SEQUENCE IF NOT EXISTS rs_teams_id_seq;

SELECT setval(
    'rs_teams_id_seq',
    GREATEST(COALESCE((SELECT MAX(new_numeric_id) FROM rs_teams), 0), 1),
    COALESCE((SELECT COUNT(*) FROM rs_teams), 0) > 0
);

-- Drop team-related constraints before changing column types.
ALTER TABLE rs_team_members DROP CONSTRAINT IF EXISTS fk_team_member_team;
ALTER TABLE rs_team_members DROP CONSTRAINT IF EXISTS uk_team_member;

ALTER TABLE rs_activity DROP CONSTRAINT IF EXISTS fk_activity_home_team;
ALTER TABLE rs_activity DROP CONSTRAINT IF EXISTS fk_activity_away_team;

ALTER TABLE rs_challenges DROP CONSTRAINT IF EXISTS fk_challenges_host_team;
ALTER TABLE rs_challenges DROP CONSTRAINT IF EXISTS fk_challenges_guest_team;
ALTER TABLE rs_challenges DROP CONSTRAINT IF EXISTS ck_challenges_teams_not_same;

ALTER TABLE rs_activity_team_checkin_configs DROP CONSTRAINT IF EXISTS fk_activity_team_checkin_team;
ALTER TABLE rs_activity_team_checkin_configs DROP CONSTRAINT IF EXISTS rs_activity_team_checkin_configs_pkey;

ALTER TABLE rs_activity_checkins DROP CONSTRAINT IF EXISTS fk_activity_checkins_team;
ALTER TABLE rs_activity_checkins DROP CONSTRAINT IF EXISTS uq_activity_checkins;

ALTER TABLE rs_team_credit_transactions DROP CONSTRAINT IF EXISTS fk_team_credit_transactions_team;
ALTER TABLE rs_team_credit_transactions DROP CONSTRAINT IF EXISTS fk_team_credit_transactions_reviewer_team;

ALTER TABLE rs_activity_team_reviews DROP CONSTRAINT IF EXISTS fk_activity_team_reviews_reviewer_team;
ALTER TABLE rs_activity_team_reviews DROP CONSTRAINT IF EXISTS fk_activity_team_reviews_reviewee_team;
ALTER TABLE rs_activity_team_reviews DROP CONSTRAINT IF EXISTS uk_activity_team_reviews;
ALTER TABLE rs_activity_team_reviews DROP CONSTRAINT IF EXISTS ck_activity_team_reviews_not_self;

ALTER TABLE rs_team_membership_orders DROP CONSTRAINT IF EXISTS fk_team_membership_orders_team;

ALTER TABLE rs_teams DROP CONSTRAINT IF EXISTS fk_team_captain;
ALTER TABLE rs_teams DROP CONSTRAINT IF EXISTS rs_teams_pkey;
ALTER TABLE rs_teams DROP CONSTRAINT IF EXISTS uk_team_name;

-- Add temporary numeric reference columns.
ALTER TABLE rs_team_members ADD COLUMN IF NOT EXISTS team_id_new BIGINT;
ALTER TABLE rs_activity ADD COLUMN IF NOT EXISTS home_team_id_new BIGINT;
ALTER TABLE rs_activity ADD COLUMN IF NOT EXISTS away_team_id_new BIGINT;
ALTER TABLE rs_challenges ADD COLUMN IF NOT EXISTS host_team_id_new BIGINT;
ALTER TABLE rs_challenges ADD COLUMN IF NOT EXISTS guest_team_id_new BIGINT;
ALTER TABLE rs_activity_team_checkin_configs ADD COLUMN IF NOT EXISTS team_id_new BIGINT;
ALTER TABLE rs_activity_checkins ADD COLUMN IF NOT EXISTS team_id_new BIGINT;
ALTER TABLE rs_team_credit_transactions ADD COLUMN IF NOT EXISTS team_id_new BIGINT;
ALTER TABLE rs_team_credit_transactions ADD COLUMN IF NOT EXISTS reviewer_team_id_new BIGINT;
ALTER TABLE rs_activity_team_reviews ADD COLUMN IF NOT EXISTS reviewer_team_id_new BIGINT;
ALTER TABLE rs_activity_team_reviews ADD COLUMN IF NOT EXISTS reviewee_team_id_new BIGINT;
ALTER TABLE rs_team_membership_orders ADD COLUMN IF NOT EXISTS team_id_new BIGINT;
ALTER TABLE rs_admin_team_assignment ADD COLUMN IF NOT EXISTS team_id_new BIGINT;

UPDATE rs_team_members tm
SET team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE tm.team_id = t.legacy_id;

UPDATE rs_activity a
SET home_team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE a.home_team_id = t.legacy_id;

UPDATE rs_activity a
SET away_team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE a.away_team_id = t.legacy_id;

UPDATE rs_challenges c
SET host_team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE c.host_team_id = t.legacy_id;

UPDATE rs_challenges c
SET guest_team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE c.guest_team_id = t.legacy_id;

UPDATE rs_activity_team_checkin_configs cfg
SET team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE cfg.team_id = t.legacy_id;

UPDATE rs_activity_checkins ci
SET team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE ci.team_id = t.legacy_id;

UPDATE rs_team_credit_transactions tx
SET team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE tx.team_id = t.legacy_id;

UPDATE rs_team_credit_transactions tx
SET reviewer_team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE tx.reviewer_team_id = t.legacy_id;

UPDATE rs_activity_team_reviews r
SET reviewer_team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE r.reviewer_team_id = t.legacy_id;

UPDATE rs_activity_team_reviews r
SET reviewee_team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE r.reviewee_team_id = t.legacy_id;

UPDATE rs_team_membership_orders mo
SET team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE mo.team_id = t.legacy_id;

UPDATE rs_admin_team_assignment ata
SET team_id_new = t.new_numeric_id
FROM rs_teams t
WHERE ata.team_id = t.legacy_id;

-- Remove invalid orphan admin/team assignments before adding real foreign keys.
DELETE FROM rs_admin_team_assignment
WHERE team_id_new IS NULL
   OR NOT EXISTS (SELECT 1 FROM rs_admin_user admin WHERE admin.id = rs_admin_team_assignment.admin_id);

-- Required team references must be successfully mapped.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM rs_team_members WHERE team_id_new IS NULL) THEN
        RAISE EXCEPTION 'rs_team_members contains team_id values that cannot be mapped to numeric team IDs';
    END IF;
    IF EXISTS (SELECT 1 FROM rs_challenges WHERE host_team_id_new IS NULL) THEN
        RAISE EXCEPTION 'rs_challenges contains host_team_id values that cannot be mapped to numeric team IDs';
    END IF;
    IF EXISTS (SELECT 1 FROM rs_activity_team_checkin_configs WHERE team_id_new IS NULL) THEN
        RAISE EXCEPTION 'rs_activity_team_checkin_configs contains team_id values that cannot be mapped to numeric team IDs';
    END IF;
    IF EXISTS (SELECT 1 FROM rs_activity_checkins WHERE team_id_new IS NULL) THEN
        RAISE EXCEPTION 'rs_activity_checkins contains team_id values that cannot be mapped to numeric team IDs';
    END IF;
    IF EXISTS (SELECT 1 FROM rs_team_credit_transactions WHERE team_id_new IS NULL) THEN
        RAISE EXCEPTION 'rs_team_credit_transactions contains team_id values that cannot be mapped to numeric team IDs';
    END IF;
    IF EXISTS (SELECT 1 FROM rs_activity_team_reviews WHERE reviewer_team_id_new IS NULL OR reviewee_team_id_new IS NULL) THEN
        RAISE EXCEPTION 'rs_activity_team_reviews contains team ID values that cannot be mapped to numeric team IDs';
    END IF;
END $$;

-- Replace old team reference columns with numeric columns.
ALTER TABLE rs_team_members DROP COLUMN team_id;
ALTER TABLE rs_team_members RENAME COLUMN team_id_new TO team_id;
ALTER TABLE rs_team_members ALTER COLUMN team_id SET NOT NULL;

ALTER TABLE rs_activity DROP COLUMN home_team_id;
ALTER TABLE rs_activity RENAME COLUMN home_team_id_new TO home_team_id;
ALTER TABLE rs_activity DROP COLUMN away_team_id;
ALTER TABLE rs_activity RENAME COLUMN away_team_id_new TO away_team_id;

ALTER TABLE rs_challenges DROP COLUMN host_team_id;
ALTER TABLE rs_challenges RENAME COLUMN host_team_id_new TO host_team_id;
ALTER TABLE rs_challenges ALTER COLUMN host_team_id SET NOT NULL;
ALTER TABLE rs_challenges DROP COLUMN guest_team_id;
ALTER TABLE rs_challenges RENAME COLUMN guest_team_id_new TO guest_team_id;

ALTER TABLE rs_activity_team_checkin_configs DROP COLUMN team_id;
ALTER TABLE rs_activity_team_checkin_configs RENAME COLUMN team_id_new TO team_id;
ALTER TABLE rs_activity_team_checkin_configs ALTER COLUMN team_id SET NOT NULL;

ALTER TABLE rs_activity_checkins DROP COLUMN team_id;
ALTER TABLE rs_activity_checkins RENAME COLUMN team_id_new TO team_id;
ALTER TABLE rs_activity_checkins ALTER COLUMN team_id SET NOT NULL;

ALTER TABLE rs_team_credit_transactions DROP COLUMN team_id;
ALTER TABLE rs_team_credit_transactions RENAME COLUMN team_id_new TO team_id;
ALTER TABLE rs_team_credit_transactions ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE rs_team_credit_transactions DROP COLUMN reviewer_team_id;
ALTER TABLE rs_team_credit_transactions RENAME COLUMN reviewer_team_id_new TO reviewer_team_id;

ALTER TABLE rs_activity_team_reviews DROP COLUMN reviewer_team_id;
ALTER TABLE rs_activity_team_reviews RENAME COLUMN reviewer_team_id_new TO reviewer_team_id;
ALTER TABLE rs_activity_team_reviews ALTER COLUMN reviewer_team_id SET NOT NULL;
ALTER TABLE rs_activity_team_reviews DROP COLUMN reviewee_team_id;
ALTER TABLE rs_activity_team_reviews RENAME COLUMN reviewee_team_id_new TO reviewee_team_id;
ALTER TABLE rs_activity_team_reviews ALTER COLUMN reviewee_team_id SET NOT NULL;

ALTER TABLE rs_team_membership_orders DROP COLUMN team_id;
ALTER TABLE rs_team_membership_orders RENAME COLUMN team_id_new TO team_id;
ALTER TABLE rs_team_membership_orders ALTER COLUMN team_id SET NOT NULL;

ALTER TABLE rs_admin_team_assignment DROP COLUMN team_id;
ALTER TABLE rs_admin_team_assignment RENAME COLUMN team_id_new TO team_id;
ALTER TABLE rs_admin_team_assignment ALTER COLUMN team_id SET NOT NULL;

-- Replace team primary key.
ALTER TABLE rs_teams DROP COLUMN id;
ALTER TABLE rs_teams RENAME COLUMN new_numeric_id TO id;
ALTER TABLE rs_teams ALTER COLUMN id SET NOT NULL;
ALTER TABLE rs_teams ALTER COLUMN id SET DEFAULT nextval('rs_teams_id_seq'::regclass);
ALTER SEQUENCE rs_teams_id_seq OWNED BY rs_teams.id;

ALTER TABLE rs_teams ADD CONSTRAINT rs_teams_pkey PRIMARY KEY (id);
ALTER TABLE rs_teams ADD CONSTRAINT uk_team_name UNIQUE (name);
ALTER TABLE rs_teams ADD CONSTRAINT uk_teams_legacy_id UNIQUE (legacy_id);
ALTER TABLE rs_teams
    ADD CONSTRAINT fk_team_captain FOREIGN KEY (captain_id) REFERENCES rs_user_info (id);

-- Recreate team foreign keys and uniqueness constraints.
ALTER TABLE rs_team_members
    ADD CONSTRAINT uk_team_member UNIQUE (team_id, user_id),
    ADD CONSTRAINT fk_team_member_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE;

ALTER TABLE rs_activity
    ADD CONSTRAINT fk_activity_home_team FOREIGN KEY (home_team_id) REFERENCES rs_teams (id),
    ADD CONSTRAINT fk_activity_away_team FOREIGN KEY (away_team_id) REFERENCES rs_teams (id);

ALTER TABLE rs_challenges
    ADD CONSTRAINT fk_challenges_host_team FOREIGN KEY (host_team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_challenges_guest_team FOREIGN KEY (guest_team_id) REFERENCES rs_teams (id) ON DELETE SET NULL,
    ADD CONSTRAINT ck_challenges_teams_not_same CHECK (guest_team_id IS NULL OR host_team_id <> guest_team_id);

ALTER TABLE rs_activity_team_checkin_configs
    ADD PRIMARY KEY (activity_id, team_id),
    ADD CONSTRAINT fk_activity_team_checkin_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE;

ALTER TABLE rs_activity_checkins
    ADD CONSTRAINT uq_activity_checkins UNIQUE (activity_id, team_id, user_id),
    ADD CONSTRAINT fk_activity_checkins_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE;

ALTER TABLE rs_team_credit_transactions
    ADD CONSTRAINT fk_team_credit_transactions_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_team_credit_transactions_reviewer_team FOREIGN KEY (reviewer_team_id) REFERENCES rs_teams (id) ON DELETE SET NULL;

ALTER TABLE rs_activity_team_reviews
    ADD CONSTRAINT fk_activity_team_reviews_reviewer_team FOREIGN KEY (reviewer_team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_activity_team_reviews_reviewee_team FOREIGN KEY (reviewee_team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    ADD CONSTRAINT uk_activity_team_reviews UNIQUE (activity_id, reviewer_team_id),
    ADD CONSTRAINT ck_activity_team_reviews_not_self CHECK (reviewer_team_id <> reviewee_team_id);

ALTER TABLE rs_team_membership_orders
    ADD CONSTRAINT fk_team_membership_orders_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE RESTRICT;

ALTER TABLE rs_admin_team_assignment
    ADD CONSTRAINT uq_admin_team UNIQUE (admin_id, team_id),
    ADD CONSTRAINT fk_admin_team_assignment_admin FOREIGN KEY (admin_id) REFERENCES rs_admin_user (id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_admin_team_assignment_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE;

-- Add the missing physical FK for user billing records now that bad billing data has been cleared.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_billings_activity'
    ) THEN
        ALTER TABLE rs_user_billings
            ADD CONSTRAINT fk_user_billings_activity
            FOREIGN KEY (game_id) REFERENCES rs_activity (id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Recreate indexes that were dropped with old team columns.
CREATE INDEX IF NOT EXISTS idx_team_captain_id ON rs_teams (captain_id);
CREATE INDEX IF NOT EXISTS idx_team_status ON rs_teams (status);
CREATE INDEX IF NOT EXISTS idx_teams_credit_score ON rs_teams (credit_score);
CREATE INDEX IF NOT EXISTS idx_teams_vip_until ON rs_teams (vip_until);
CREATE INDEX IF NOT EXISTS idx_team_member_team ON rs_team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_activity_home_team_id ON rs_activity (home_team_id);
CREATE INDEX IF NOT EXISTS idx_activity_away_team_id ON rs_activity (away_team_id);
CREATE INDEX IF NOT EXISTS idx_challenges_host_team ON rs_challenges (host_team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_guest_team ON rs_challenges (guest_team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_team_checkin_team ON rs_activity_team_checkin_configs (team_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_checkins_team ON rs_activity_checkins (team_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_credit_transactions_team ON rs_team_credit_transactions (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_team_reviews_reviewee ON rs_activity_team_reviews (reviewee_team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_membership_orders_team ON rs_team_membership_orders (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ata_team_id ON rs_admin_team_assignment(team_id);

-- If current data contains only one team, the first team naturally becomes id = 1
-- through the generated numeric sequence. Team names are intentionally not hard-coded.
