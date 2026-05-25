ALTER TABLE rs_user_info
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_user_info_username_non_empty
    ON rs_user_info (username)
    WHERE username <> '' AND password_hash IS NOT NULL;
