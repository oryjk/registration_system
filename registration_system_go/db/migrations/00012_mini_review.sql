-- +goose Up
CREATE TABLE mini_review_statuses (
    id BIGSERIAL PRIMARY KEY,
    project_code TEXT NOT NULL,
    version TEXT NOT NULL,
    version_code BIGINT NOT NULL,
    is_reviewing BOOLEAN NOT NULL DEFAULT TRUE,
    status_text TEXT NOT NULL DEFAULT '正在审核',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mini_review_project_version UNIQUE (project_code, version)
);

CREATE INDEX idx_mini_review_project_version_code ON mini_review_statuses (project_code, version_code DESC);

-- +goose Down
DROP TABLE IF EXISTS mini_review_statuses;
