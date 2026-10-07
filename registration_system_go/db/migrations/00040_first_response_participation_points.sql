-- +goose Up
-- 保留旧视图列名/类型/顺序，追加组成项；旧后端显式列查询仍可读取。
CREATE OR REPLACE VIEW team_participation_points AS
SELECT r.id AS registration_id, g.match_id, g.team_id, r.user_id,
       m.start_time AS match_start_time,
       EXTRACT(YEAR FROM ((m.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai'))::integer AS score_year,
       (CASE WHEN r.status='attending' THEN r.participation_base_points ELSE 0 END
         + CASE WHEN r.participation_confirmed_at IS NOT NULL THEN r.early_registration_bonus ELSE 0 END)::bigint AS points,
       r.participation_rule_version AS rule_version,
       (CASE WHEN r.status='attending' THEN r.participation_base_points ELSE 0 END)::bigint AS attendance_points,
       (CASE WHEN r.participation_confirmed_at IS NOT NULL THEN r.early_registration_bonus ELSE 0 END)::bigint AS response_points,
       g.id AS group_id
FROM match_registrations r
JOIN match_registration_groups g ON g.id=r.group_id
JOIN matches m ON m.id=g.match_id
WHERE g.kind IN ('host_team','guest_team') AND g.team_id IS NOT NULL
  AND g.status<>'cancelled' AND m.status<>'cancelled'
  AND (r.status='attending' OR (r.participation_confirmed_at IS NOT NULL AND r.early_registration_bonus>0))
  AND (m.status='ended' OR m.end_time <= (NOW() AT TIME ZONE 'UTC'))
  AND m.start_time < (((date_trunc('day',NOW() AT TIME ZONE 'Asia/Shanghai') + INTERVAL '1 day') AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC');

CREATE OR REPLACE VIEW team_participation_totals AS
SELECT team_id,user_id,score_year,SUM(points)::bigint AS participation_points,
       COUNT(*) FILTER (WHERE attendance_points>0)::bigint AS attended_count
FROM team_participation_points GROUP BY team_id,user_id,score_year;

-- +goose Down
-- 保留新增视图列和奖励事实，只恢复旧版只给参加者计分的口径。
CREATE OR REPLACE VIEW team_participation_points AS
SELECT r.id AS registration_id,g.match_id,g.team_id,r.user_id,
       m.start_time AS match_start_time,
       EXTRACT(YEAR FROM ((m.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai'))::integer AS score_year,
       (r.participation_base_points + CASE WHEN r.participation_confirmed_at IS NOT NULL THEN r.early_registration_bonus ELSE 0 END)::bigint AS points,
       r.participation_rule_version AS rule_version,
       r.participation_base_points::bigint AS attendance_points,
       (CASE WHEN r.participation_confirmed_at IS NOT NULL THEN r.early_registration_bonus ELSE 0 END)::bigint AS response_points,
       g.id AS group_id
FROM match_registrations r
JOIN match_registration_groups g ON g.id=r.group_id
JOIN matches m ON m.id=g.match_id
WHERE g.kind IN ('host_team','guest_team') AND g.team_id IS NOT NULL
  AND g.status<>'cancelled' AND m.status<>'cancelled' AND r.status='attending'
  AND (m.status='ended' OR m.end_time <= (NOW() AT TIME ZONE 'UTC'))
  AND m.start_time < (((date_trunc('day',NOW() AT TIME ZONE 'Asia/Shanghai') + INTERVAL '1 day') AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC');
