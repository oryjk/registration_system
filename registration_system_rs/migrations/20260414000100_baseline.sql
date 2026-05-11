CREATE TABLE IF NOT EXISTS rs_admin_user (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    is_super_admin SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_time TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT uk_admin_username UNIQUE (username)
);
CREATE INDEX IF NOT EXISTS idx_admin_status ON rs_admin_user (status);

CREATE TABLE IF NOT EXISTS rs_user_info (
    id BIGSERIAL PRIMARY KEY,
    open_id VARCHAR(128) NOT NULL,
    union_id VARCHAR(128) NULL,
    username VARCHAR(100) NOT NULL DEFAULT '',
    nickname VARCHAR(100) NOT NULL DEFAULT '',
    real_name VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url VARCHAR(500) NOT NULL DEFAULT '',
    phone_number VARCHAR(32) NOT NULL DEFAULT '',
    is_manager SMALLINT NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT NOW(),
    latest_login_date TIMESTAMP NOT NULL DEFAULT NOW(),
    leave_start_time TIMESTAMP NULL,
    leave_end_time TIMESTAMP NULL,
    CONSTRAINT uk_user_open_id UNIQUE (open_id)
);
CREATE INDEX IF NOT EXISTS idx_user_status ON rs_user_info (status);
CREATE INDEX IF NOT EXISTS idx_user_name ON rs_user_info (username);
CREATE INDEX IF NOT EXISTS idx_user_phone ON rs_user_info (phone_number);

CREATE TABLE IF NOT EXISTS rs_teams (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    logo_url VARCHAR(500) NULL,
    captain_id BIGINT NULL,
    join_password_hash VARCHAR(255) NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_team_name UNIQUE (name),
    CONSTRAINT fk_team_captain FOREIGN KEY (captain_id) REFERENCES rs_user_info (id)
);
CREATE INDEX IF NOT EXISTS idx_team_captain_id ON rs_teams (captain_id);
CREATE INDEX IF NOT EXISTS idx_team_status ON rs_teams (status);

CREATE TABLE IF NOT EXISTS rs_team_members (
    id BIGSERIAL PRIMARY KEY,
    team_id CHAR(36) NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    jersey_number VARCHAR(16) NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_team_member UNIQUE (team_id, user_id),
    CONSTRAINT fk_team_member_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    CONSTRAINT fk_team_member_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_team_member_team ON rs_team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_member_user ON rs_team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_team_member_status ON rs_team_members (status);

CREATE TABLE IF NOT EXISTS rs_activity (
    id CHAR(36) PRIMARY KEY,
    cover VARCHAR(500) NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    holding_date TIMESTAMP NOT NULL,
    location VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    opposing VARCHAR(255) NULL,
    status SMALLINT NOT NULL DEFAULT 0,
    description TEXT NULL,
    home_team_id CHAR(36) NULL,
    away_team_id CHAR(36) NULL,
    color VARCHAR(32) NULL,
    opposing_color VARCHAR(32) NULL,
    players_per_team INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_activity_home_team FOREIGN KEY (home_team_id) REFERENCES rs_teams (id),
    CONSTRAINT fk_activity_away_team FOREIGN KEY (away_team_id) REFERENCES rs_teams (id)
);
CREATE INDEX IF NOT EXISTS idx_activity_status ON rs_activity (status);
CREATE INDEX IF NOT EXISTS idx_activity_holding_date ON rs_activity (holding_date);
CREATE INDEX IF NOT EXISTS idx_activity_home_team_id ON rs_activity (home_team_id);
CREATE INDEX IF NOT EXISTS idx_activity_away_team_id ON rs_activity (away_team_id);

CREATE TABLE IF NOT EXISTS rs_user_activity (
    id BIGSERIAL PRIMARY KEY,
    activity_id CHAR(36) NOT NULL,
    user_id BIGINT NOT NULL,
    stand SMALLINT NOT NULL DEFAULT 0,
    registration_count INT NOT NULL DEFAULT 0,
    paid SMALLINT NOT NULL DEFAULT 0,
    operation_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_activity_user UNIQUE (activity_id, user_id),
    CONSTRAINT fk_user_activity_activity FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_activity_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON rs_user_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_stand ON rs_user_activity (stand);

CREATE TABLE IF NOT EXISTS rs_registration_log (
    id BIGSERIAL PRIMARY KEY,
    activity_id CHAR(36) NOT NULL,
    user_id BIGINT NOT NULL,
    previous_stand SMALLINT NULL,
    current_stand SMALLINT NOT NULL,
    registration_count INT NOT NULL DEFAULT 0,
    operation_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_registration_log_activity FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE CASCADE,
    CONSTRAINT fk_registration_log_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_registration_log_activity ON rs_registration_log (activity_id);
CREATE INDEX IF NOT EXISTS idx_registration_log_user ON rs_registration_log (user_id);

CREATE TABLE IF NOT EXISTS rs_activity_order (
    id BIGSERIAL PRIMARY KEY,
    activity_id CHAR(36) NOT NULL,
    description VARCHAR(500) NOT NULL,
    fee DECIMAL(10, 2) NOT NULL,
    total INT NOT NULL,
    activity_holding_time TIMESTAMP NULL,
    create_time TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_activity_order_activity UNIQUE (activity_id),
    CONSTRAINT fk_activity_order_activity FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rs_user_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_recharge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_expense DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_penalty DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    version INT NOT NULL DEFAULT 1,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_user_accounts_user UNIQUE (user_id),
    CONSTRAINT fk_user_accounts_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_accounts_status ON rs_user_accounts (status);

CREATE TABLE IF NOT EXISTS rs_user_balance_adjustments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_balance DECIMAL(10, 2) NOT NULL,
    effective_time TIMESTAMP NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_by BIGINT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_balance_adjustments_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE,
    CONSTRAINT fk_balance_adjustments_admin FOREIGN KEY (created_by) REFERENCES rs_admin_user (id)
);
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_user ON rs_user_balance_adjustments (user_id);
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_effective_time ON rs_user_balance_adjustments (effective_time);

CREATE TABLE IF NOT EXISTS rs_user_billings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    game_id CHAR(36) NOT NULL,
    fee DECIMAL(10, 2) NOT NULL,
    billing_type VARCHAR(32) NOT NULL DEFAULT 'game_fee',
    description VARCHAR(500) NULL,
    billing_date DATE NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_billings_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_billings_user ON rs_user_billings (user_id);
CREATE INDEX IF NOT EXISTS idx_user_billings_game ON rs_user_billings (game_id);
CREATE INDEX IF NOT EXISTS idx_user_billings_date ON rs_user_billings (billing_date);

CREATE TABLE IF NOT EXISTS rs_monthly_penalties (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    month_key VARCHAR(10) NOT NULL,
    fee DECIMAL(10, 2) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    penalty_date DATE NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_monthly_penalties_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_monthly_penalties_user ON rs_monthly_penalties (user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_penalties_month_key ON rs_monthly_penalties (month_key);

CREATE TABLE IF NOT EXISTS rs_recharge_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(32) NOT NULL DEFAULT 'wechat',
    transaction_no VARCHAR(100) NULL,
    recharge_date DATE NOT NULL,
    description VARCHAR(500) NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_recharge_records_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_recharge_records_user ON rs_recharge_records (user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_records_date ON rs_recharge_records (recharge_date);

CREATE TABLE IF NOT EXISTS rs_user_monthly_balance (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    month_key VARCHAR(10) NOT NULL,
    balance_start DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    balance_end DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_expenses DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_penalties DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_recharges DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    game_fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    equipment_fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    venue_fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_user_monthly_balance UNIQUE (user_id, month_key),
    CONSTRAINT fk_user_monthly_balance_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rs_team_fund_account (
    id BIGSERIAL PRIMARY KEY,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_income DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_expense DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rs_team_fund_transactions (
    id BIGSERIAL PRIMARY KEY,
    transaction_type VARCHAR(32) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    source_id BIGINT NULL,
    description VARCHAR(500) NOT NULL,
    transaction_date DATE NOT NULL,
    balance_after DECIMAL(10, 2) NOT NULL,
    created_by BIGINT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_team_fund_transactions_admin FOREIGN KEY (created_by) REFERENCES rs_admin_user (id)
);
CREATE INDEX IF NOT EXISTS idx_team_fund_transactions_date ON rs_team_fund_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_team_fund_transactions_source ON rs_team_fund_transactions (source_type, source_id);

CREATE TABLE IF NOT EXISTS rs_payment_orders (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_type VARCHAR(32) NOT NULL DEFAULT 'wechat',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    prepay_id VARCHAR(128) NULL,
    transaction_id VARCHAR(128) NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMP NULL DEFAULT NULL,
    cancelled_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT uk_payment_orders_order_no UNIQUE (order_no),
    CONSTRAINT fk_payment_orders_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON rs_payment_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON rs_payment_orders (status);

INSERT INTO rs_team_fund_account (balance, total_income, total_expense)
SELECT 0.00, 0.00, 0.00
WHERE NOT EXISTS (SELECT 1 FROM rs_team_fund_account);
