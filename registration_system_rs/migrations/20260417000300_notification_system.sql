CREATE TABLE IF NOT EXISTS rs_user_notifications (
    id CHAR(36) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    kind VARCHAR(50) NOT NULL,
    title VARCHAR(120) NOT NULL,
    content VARCHAR(500) NOT NULL,
    related_type VARCHAR(50) NULL,
    related_id VARCHAR(64) NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id) REFERENCES rs_user_info (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created_at
    ON rs_user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read_at
    ON rs_user_notifications (user_id, read_at);
