ALTER TABLE rs_teams
    ADD COLUMN IF NOT EXISTS credit_score INT NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS vip_until TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_teams_credit_score ON rs_teams (credit_score);
CREATE INDEX IF NOT EXISTS idx_teams_vip_until ON rs_teams (vip_until);

CREATE TABLE IF NOT EXISTS rs_team_credit_transactions (
    id BIGSERIAL PRIMARY KEY,
    team_id CHAR(36) NOT NULL,
    activity_id CHAR(36) NULL,
    transaction_type VARCHAR(32) NOT NULL,
    delta INT NOT NULL,
    score_before INT NOT NULL,
    score_after INT NOT NULL,
    rating SMALLINT NULL,
    amount DECIMAL(10, 2) NULL,
    membership_months INT NULL,
    note VARCHAR(500) NULL,
    reviewer_team_id CHAR(36) NULL,
    created_by_user_id BIGINT NULL,
    created_by_admin_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_team_credit_transactions_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    CONSTRAINT fk_team_credit_transactions_activity FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE SET NULL,
    CONSTRAINT fk_team_credit_transactions_reviewer_team FOREIGN KEY (reviewer_team_id) REFERENCES rs_teams (id) ON DELETE SET NULL,
    CONSTRAINT fk_team_credit_transactions_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES rs_user_info (id) ON DELETE SET NULL,
    CONSTRAINT fk_team_credit_transactions_admin FOREIGN KEY (created_by_admin_id) REFERENCES rs_admin_user (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_team_credit_transactions_team ON rs_team_credit_transactions (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_credit_transactions_activity ON rs_team_credit_transactions (activity_id);
CREATE INDEX IF NOT EXISTS idx_team_credit_transactions_type ON rs_team_credit_transactions (transaction_type);

CREATE TABLE IF NOT EXISTS rs_activity_team_reviews (
    id BIGSERIAL PRIMARY KEY,
    activity_id CHAR(36) NOT NULL,
    reviewer_team_id CHAR(36) NOT NULL,
    reviewer_user_id BIGINT NOT NULL,
    reviewee_team_id CHAR(36) NOT NULL,
    rating SMALLINT NOT NULL,
    credit_delta INT NOT NULL,
    comment VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_activity_team_reviews_activity FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_team_reviews_reviewer_team FOREIGN KEY (reviewer_team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_team_reviews_reviewee_team FOREIGN KEY (reviewee_team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_team_reviews_reviewer_user FOREIGN KEY (reviewer_user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE,
    CONSTRAINT uk_activity_team_reviews UNIQUE (activity_id, reviewer_team_id),
    CONSTRAINT ck_activity_team_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT ck_activity_team_reviews_not_self CHECK (reviewer_team_id <> reviewee_team_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_team_reviews_reviewee ON rs_activity_team_reviews (reviewee_team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_team_reviews_activity ON rs_activity_team_reviews (activity_id);

CREATE TABLE IF NOT EXISTS rs_team_membership_orders (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(64) NOT NULL,
    team_id CHAR(36) NOT NULL,
    user_id BIGINT NOT NULL,
    months INT NOT NULL,
    credit_delta INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    note VARCHAR(500) NULL,
    applied_at TIMESTAMP NULL,
    transaction_id VARCHAR(128) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_team_membership_orders_order_no UNIQUE (order_no),
    CONSTRAINT fk_team_membership_orders_order_no FOREIGN KEY (order_no) REFERENCES rs_payment_orders (order_no) ON DELETE CASCADE,
    CONSTRAINT fk_team_membership_orders_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    CONSTRAINT fk_team_membership_orders_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_membership_orders_team ON rs_team_membership_orders (team_id, created_at DESC);
