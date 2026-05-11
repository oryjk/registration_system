CREATE TABLE IF NOT EXISTS rs_challenges (
    id CHAR(36) PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    host_team_id CHAR(36) NOT NULL,
    host_user_id BIGINT NOT NULL,
    guest_team_id CHAR(36) NULL,
    accepted_by_user_id BIGINT NULL,
    activity_id CHAR(36) NULL,
    holding_date TIMESTAMP NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location VARCHAR(255) NOT NULL,
    location_latitude DOUBLE PRECISION NULL,
    location_longitude DOUBLE PRECISION NULL,
    players_per_team INT NOT NULL,
    fee_per_person DECIMAL(10, 2) NULL,
    note VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    accepted_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_challenges_host_team FOREIGN KEY (host_team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    CONSTRAINT fk_challenges_host_user FOREIGN KEY (host_user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE,
    CONSTRAINT fk_challenges_guest_team FOREIGN KEY (guest_team_id) REFERENCES rs_teams (id) ON DELETE SET NULL,
    CONSTRAINT fk_challenges_accepted_user FOREIGN KEY (accepted_by_user_id) REFERENCES rs_user_info (id) ON DELETE SET NULL,
    CONSTRAINT fk_challenges_activity FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE SET NULL,
    CONSTRAINT ck_challenges_status CHECK (status IN ('open', 'matched', 'cancelled')),
    CONSTRAINT ck_challenges_teams_not_same CHECK (guest_team_id IS NULL OR host_team_id <> guest_team_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_host_team ON rs_challenges (host_team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_guest_team ON rs_challenges (guest_team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_status_holding_date ON rs_challenges (status, holding_date DESC);
