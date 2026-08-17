-- +goose Up
-- 比赛是否免费报名：新建比赛默认免费；
-- 历史比赛（legacy 迁移）均为收费结算，回填为不免费。
ALTER TABLE matches ADD COLUMN is_free BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE matches SET is_free = FALSE;

-- +goose Down
ALTER TABLE matches DROP COLUMN is_free;
