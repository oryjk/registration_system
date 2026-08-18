-- +goose Up
-- 小程序可运营调整的运行时配置，按分区键存 JSONB（当前仅 debug 分区）。
CREATE TABLE mini_app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS mini_app_settings;
