-- +goose Up
-- 管理端删除已解散球队：teams.status 增加 'deleted'。
-- 仍被比赛/申请/支付等历史数据引用的解散球队删除时转为 deleted（软删除），
-- 从管理列表默认视图移除，同时保留球队行以维持历史数据引用与展示。

ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_status_check;
ALTER TABLE teams ADD CONSTRAINT teams_status_check CHECK (status IN ('active', 'frozen', 'dissolved', 'deleted'));

-- +goose Down
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_status_check;
ALTER TABLE teams ADD CONSTRAINT teams_status_check CHECK (status IN ('active', 'frozen', 'dissolved'));
UPDATE teams SET status = 'dissolved' WHERE status = 'deleted';
