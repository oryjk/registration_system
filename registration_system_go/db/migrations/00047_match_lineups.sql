-- +goose Up
-- 比赛排阵型：每场比赛保存一套当前阵型（赛制人数、阵型名称、槽位坐标与主力/替补映射）。
-- 纯新建表，不影响线上旧镜像。
CREATE TABLE match_lineups (
    match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    players_per_team INT NOT NULL CHECK (players_per_team BETWEEN 5 AND 11),
    formation VARCHAR(32) NOT NULL,
    slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS match_lineups;
