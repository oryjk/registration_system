-- +goose Up
-- 报名窗口：报名开始/结束时间。旧系统 rs_activity.start_time/end_time 迁移而来；
-- 新建比赛未填写时为 NULL，由客户端按比赛时间推算默认窗口。
ALTER TABLE matches
    ADD COLUMN registration_start_at TIMESTAMP NULL,
    ADD COLUMN registration_end_at TIMESTAMP NULL;

-- +goose Down
ALTER TABLE matches
    DROP COLUMN registration_start_at,
    DROP COLUMN registration_end_at;
