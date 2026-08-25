-- +goose Up
-- 解散球队改为软删除：teams.status 增加 'dissolved'，
-- 保留球队行以维持历史比赛/申请/支付数据的引用与展示。
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_status_check;
ALTER TABLE teams ADD CONSTRAINT teams_status_check CHECK (status IN ('active', 'frozen', 'dissolved'));
