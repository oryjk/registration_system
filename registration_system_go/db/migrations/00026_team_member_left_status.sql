-- +goose Up
-- 成员自助退出球队：状态置为 left（区别于被移除的 inactive），保留关联与历史数据。
ALTER TABLE team_members DROP CONSTRAINT team_members_status_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_status_check CHECK (status IN ('active', 'inactive', 'left'));

-- +goose Down
ALTER TABLE team_members DROP CONSTRAINT team_members_status_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_status_check CHECK (status IN ('active', 'inactive'));
