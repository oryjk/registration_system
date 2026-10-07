-- +goose Up
-- 积分整数统一以十分之一分为单位：70=7分，30/24/15/6=3/2.4/1.5/0.6分。
-- API在汇总后除以10，保留一位小数，避免积分累计和排行的浮点误差。
-- 加法迁移；旧 sqlc 查询已展开显式列，不影响旧镜像扫描。历史记录不推断本人报名时间。
ALTER TABLE match_registrations
    ADD COLUMN IF NOT EXISTS participation_confirmed_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS early_registration_bonus INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS participation_base_points INTEGER NOT NULL DEFAULT 70,
    ADD COLUMN IF NOT EXISTS participation_rule_version INTEGER NOT NULL DEFAULT 1;

-- 每场积分事实：规则/奖励已持久化，出勤修正自动更新对应年度，不重复累计。
CREATE VIEW team_participation_points AS
SELECT r.id AS registration_id, g.match_id, g.team_id, r.user_id,
       m.start_time AS match_start_time,
       EXTRACT(YEAR FROM ((m.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai'))::integer AS score_year,
       (r.participation_base_points + CASE WHEN r.participation_confirmed_at IS NOT NULL THEN r.early_registration_bonus ELSE 0 END)::bigint AS points,
       r.participation_rule_version AS rule_version
FROM match_registrations r
JOIN match_registration_groups g ON g.id = r.group_id
JOIN matches m ON m.id = g.match_id
WHERE g.kind IN ('host_team', 'guest_team') AND g.team_id IS NOT NULL
  AND g.status <> 'cancelled' AND m.status <> 'cancelled' AND r.status = 'attending'
  AND (m.status = 'ended' OR m.end_time <= (NOW() AT TIME ZONE 'UTC'))
  AND m.start_time < (((date_trunc('day', NOW() AT TIME ZONE 'Asia/Shanghai') + INTERVAL '1 day') AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC');

CREATE VIEW team_participation_totals AS
SELECT team_id, user_id, score_year, SUM(points)::bigint AS participation_points,
       COUNT(*)::bigint AS attended_count
FROM team_participation_points GROUP BY team_id, user_id, score_year;

CREATE VIEW team_participation_ranks AS
SELECT p.team_id, p.user_id, p.score_year, p.participation_points,
       ROW_NUMBER() OVER (PARTITION BY p.team_id, p.score_year ORDER BY
         p.participation_points DESC, p.attended_count DESC, tm.joined_at ASC, p.user_id ASC) AS participation_rank
FROM team_participation_totals p
JOIN team_members tm ON tm.team_id=p.team_id AND tm.user_id=p.user_id
WHERE tm.status='active' AND p.participation_points > 0;

-- +goose Down
-- 不自动删除积分事实；已上线后回滚镜像保留这些兼容字段。
DROP VIEW team_participation_ranks;
DROP VIEW team_participation_totals;
DROP VIEW team_participation_points;
