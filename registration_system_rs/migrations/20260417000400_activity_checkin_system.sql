CREATE TABLE IF NOT EXISTS rs_activity_team_checkin_configs (
    activity_id CHAR(36) NOT NULL,
    team_id CHAR(36) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    radius_meters INTEGER NOT NULL,
    open_minutes_before INTEGER NOT NULL,
    close_minutes_after INTEGER NOT NULL,
    updated_by_user_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (activity_id, team_id),
    CONSTRAINT fk_activity_team_checkin_activity FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_team_checkin_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_team_checkin_user FOREIGN KEY (updated_by_user_id) REFERENCES rs_user_info (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_team_checkin_team
    ON rs_activity_team_checkin_configs (team_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS rs_activity_checkins (
    id BIGSERIAL PRIMARY KEY,
    activity_id CHAR(36) NOT NULL,
    team_id CHAR(36) NOT NULL,
    user_id BIGINT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    distance_meters INTEGER NOT NULL,
    checked_in_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_activity_checkins UNIQUE (activity_id, team_id, user_id),
    CONSTRAINT fk_activity_checkins_activity FOREIGN KEY (activity_id) REFERENCES rs_activity (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_checkins_team FOREIGN KEY (team_id) REFERENCES rs_teams (id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_checkins_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_checkins_activity
    ON rs_activity_checkins (activity_id, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_checkins_team
    ON rs_activity_checkins (team_id, checked_in_at DESC);
