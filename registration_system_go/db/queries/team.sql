-- name: GetTeamByID :one
SELECT id, name, description, logo_url, captain_id, status, created_at, updated_at
FROM teams
WHERE id = $1;

-- name: CreateTeam :one
INSERT INTO teams (name, description, status)
VALUES ($1, $2, 'active')
RETURNING teams.id, teams.name, teams.description, teams.logo_url, teams.captain_id, teams.status, teams.created_at, teams.updated_at;

-- name: GetActiveTeamMember :one
SELECT id, team_id, user_id, role, status, joined_at, created_at, updated_at
FROM team_members
WHERE team_id = $1
  AND user_id = $2
  AND status = 'active';

-- name: ListActiveUserTeams :many
SELECT t.id,
       t.name,
       t.description,
       t.logo_url,
       t.captain_id,
       t.status,
       tm.role AS member_role,
       tm.joined_at,
       t.created_at,
       t.updated_at
FROM team_members tm
JOIN teams t ON t.id = tm.team_id
WHERE tm.user_id = $1
  AND tm.status = 'active'
  AND t.status = 'active'
ORDER BY tm.joined_at DESC, t.id;

-- name: ListTeams :many
SELECT t.id,
       t.name,
       t.description,
       t.logo_url,
       t.captain_id,
       t.status,
       t.created_at,
       t.updated_at,
       u.nickname AS captain_nickname,
       u.avatar_url AS captain_avatar_url,
       u.real_name AS captain_real_name
FROM teams t
LEFT JOIN users u ON u.id = t.captain_id
WHERE sqlc.narg('status')::text IS NULL OR t.status = sqlc.narg('status')::text
ORDER BY t.name, t.id;

-- name: UpdateTeam :one
UPDATE teams
SET name = $2,
    description = $3,
    status = $4,
    updated_at = NOW()
WHERE id = $1
RETURNING teams.id, teams.name, teams.description, teams.logo_url, teams.captain_id, teams.status, teams.created_at, teams.updated_at;

-- name: UpdateTeamProfile :one
UPDATE teams
SET name = $2,
    description = $3,
    logo_url = $4,
    updated_at = NOW()
WHERE id = $1
RETURNING teams.id, teams.name, teams.description, teams.logo_url, teams.captain_id, teams.status, teams.created_at, teams.updated_at;

-- name: ActiveUserExists :one
SELECT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = $1
      AND u.status = 'active'
) AS exists;

-- name: DeleteTeam :execrows
DELETE FROM teams
WHERE id = $1;

-- name: ListTeamMembers :many
SELECT tm.id,
       tm.team_id,
       tm.user_id,
       tm.role,
       tm.status,
       tm.joined_at,
       u.nickname,
       u.avatar_url,
       u.real_name,
       u.phone_number
FROM team_members tm
JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = $1
ORDER BY
    CASE tm.status WHEN 'active' THEN 0 ELSE 1 END,
    CASE tm.role
        WHEN 'captain' THEN 0
        WHEN 'leader' THEN 1
        WHEN 'vice_captain' THEN 2
        ELSE 3
    END,
	    tm.joined_at,
	    tm.user_id;

-- name: FindTeamMembership :one
SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.status, tm.joined_at
FROM team_members tm
WHERE tm.team_id = $1
  AND tm.user_id = $2;

-- name: ListAppTeamMembers :many
SELECT tm.user_id,
       u.nickname,
       u.avatar_url,
       u.real_name,
       tm.role,
       tm.status,
       tm.joined_at
FROM team_members tm
JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = $1
ORDER BY
    CASE tm.status WHEN 'active' THEN 0 ELSE 1 END,
    CASE tm.role
        WHEN 'captain' THEN 0
        WHEN 'leader' THEN 1
        WHEN 'vice_captain' THEN 2
        ELSE 3
    END,
    tm.joined_at,
    tm.user_id;

-- name: ListTeamMemberCandidates :many
SELECT u.id, u.nickname, u.avatar_url, u.real_name, u.phone_number
FROM users u
WHERE u.status = 'active'
  AND NOT EXISTS (
      SELECT 1
      FROM team_members tm
      WHERE tm.team_id = $1
        AND tm.user_id = u.id
  )
  AND (
      sqlc.arg('search')::text = ''
      OR u.nickname ILIKE '%' || sqlc.arg('search')::text || '%'
      OR u.real_name ILIKE '%' || sqlc.arg('search')::text || '%'
      OR u.phone_number ILIKE '%' || sqlc.arg('search')::text || '%'
      OR u.id::text = sqlc.arg('search')::text
  )
ORDER BY u.nickname, u.id
LIMIT sqlc.arg('limit');

-- name: AddTeamMember :one
INSERT INTO team_members (team_id, user_id, role, status)
VALUES ($1, $2, $3, 'active')
RETURNING id, team_id, user_id, role, status, joined_at, created_at, updated_at;

-- name: UpdateTeamMember :execrows
UPDATE team_members
SET role = $3,
    status = $4,
    updated_at = NOW()
WHERE team_id = $1
  AND user_id = $2;

-- name: RemoveTeamMember :execrows
DELETE FROM team_members
WHERE team_id = $1
  AND user_id = $2;

-- name: SetTeamCaptain :one
WITH target AS MATERIALIZED (
    SELECT tm.user_id
    FROM team_members tm
    WHERE tm.team_id = $1
      AND tm.user_id = $2
      AND tm.status = 'active'
), demoted AS (
    UPDATE team_members AS tm
    SET role = 'member',
        updated_at = NOW()
    WHERE tm.team_id = $1
      AND tm.role = 'captain'
      AND tm.user_id <> $2
      AND EXISTS (SELECT 1 FROM target)
), promoted AS (
    UPDATE team_members AS tm
    SET role = 'captain',
        updated_at = NOW()
    WHERE tm.team_id = $1
      AND tm.user_id = $2
      AND tm.status = 'active'
      AND EXISTS (SELECT 1 FROM target)
    RETURNING tm.user_id
)
UPDATE teams
SET captain_id = (SELECT user_id FROM promoted),
    updated_at = NOW()
WHERE teams.id = $1
  AND EXISTS (SELECT 1 FROM promoted)
RETURNING teams.id, teams.name, teams.description, teams.logo_url, teams.captain_id, teams.status, teams.created_at, teams.updated_at;

-- name: ClearTeamCaptain :one
WITH demoted AS (
    UPDATE team_members AS tm
    SET role = 'member',
        updated_at = NOW()
    WHERE tm.team_id = $1
      AND tm.role = 'captain'
)
UPDATE teams
SET captain_id = NULL,
    updated_at = NOW()
WHERE teams.id = $1
RETURNING teams.id, teams.name, teams.description, teams.logo_url, teams.captain_id, teams.status, teams.created_at, teams.updated_at;

-- 比赛出勤：口径与首页"已结束"一致——非取消，且（状态已结束或已过结束时间）。
-- 队员报名挂在该队对应的报名组（host_team/guest_team）上；撤销（cancelled）的报名按未报名处理。
-- matches 时间列存 UTC 墙钟，用 (NOW() AT TIME ZONE 'utc') 保持同类型比较，避免会话时区歧义。

-- name: ListTeamMemberAttendanceRecords :many
SELECT m.id::text AS activity_id,
       m.name AS activity_name,
       m.start_time AS holding_date,
       m.location,
       COALESCE(r.status, 'unknown') AS stand_status,
       COALESCE(r.registration_count, 0) AS registration_count,
       r.updated_at AS operation_time,
       (r.id IS NOT NULL) AS registered
FROM matches m
JOIN match_registration_groups g
  ON g.match_id = m.id
 AND g.kind IN ('host_team', 'guest_team')
 AND g.team_id = $1
LEFT JOIN match_registrations r
  ON r.group_id = g.id
 AND r.user_id = $2
 AND r.status <> 'cancelled'
WHERE m.status <> 'cancelled'
  AND (m.status = 'ended' OR m.end_time <= (NOW() AT TIME ZONE 'utc'))
  AND (sqlc.narg('start_date')::date IS NULL OR m.start_time::date >= sqlc.narg('start_date')::date)
  AND (sqlc.narg('end_date')::date IS NULL OR m.start_time::date <= sqlc.narg('end_date')::date)
ORDER BY m.start_time DESC, m.id;

-- name: ListTeamAttendanceRanking :many
WITH team_matches AS (
    SELECT g.id AS group_id, g.match_id
    FROM match_registration_groups g
    JOIN matches m ON m.id = g.match_id
    WHERE g.kind IN ('host_team', 'guest_team')
      AND g.team_id = $1
      AND m.status <> 'cancelled'
      AND (m.status = 'ended' OR m.end_time <= (NOW() AT TIME ZONE 'utc'))
      AND (sqlc.narg('start_date')::date IS NULL OR m.start_time::date >= sqlc.narg('start_date')::date)
      AND (sqlc.narg('end_date')::date IS NULL OR m.start_time::date <= sqlc.narg('end_date')::date)
)
SELECT tm.user_id,
       u.nickname AS user_name,
       u.avatar_url,
       COUNT(*) AS total_count,
       COUNT(r.id) FILTER (WHERE r.status = 'attending') AS attended_count,
       COUNT(r.id) FILTER (WHERE r.status = 'leave') AS leave_count,
       COUNT(r.id) FILTER (WHERE r.status = 'absent') AS late_count,
       COUNT(*) FILTER (WHERE r.id IS NULL) AS unregistered_count
FROM team_members tm
JOIN users u ON u.id = tm.user_id
CROSS JOIN team_matches t
LEFT JOIN match_registrations r
  ON r.group_id = t.group_id
 AND r.user_id = tm.user_id
 AND r.status <> 'cancelled'
WHERE tm.team_id = $1
  AND tm.status = 'active'
GROUP BY tm.user_id, u.nickname, u.avatar_url, tm.joined_at
ORDER BY attended_count DESC, leave_count ASC, unregistered_count ASC, tm.joined_at ASC;

-- name: ListTeamMatchAttendance :many
-- 单场比赛的全队出勤：只含在职（active）成员，已退队成员不展示，按状态分组排序。
SELECT m.id::text AS activity_id,
       m.name AS activity_name,
       m.start_time AS holding_date,
       m.location,
       tm.user_id,
       u.nickname,
       u.avatar_url,
       COALESCE(r.status, 'unknown') AS stand_status,
       COALESCE(r.registration_count, 0) AS registration_count,
       r.updated_at AS operation_time,
       (r.id IS NOT NULL) AS registered
FROM matches m
JOIN match_registration_groups g
  ON g.match_id = m.id
 AND g.kind IN ('host_team', 'guest_team')
 AND g.team_id = $1
JOIN team_members tm ON tm.team_id = $1 AND tm.status = 'active'
JOIN users u ON u.id = tm.user_id
LEFT JOIN match_registrations r
  ON r.group_id = g.id
 AND r.user_id = tm.user_id
 AND r.status <> 'cancelled'
WHERE m.id = sqlc.arg('match_id')
  AND m.status <> 'cancelled'
  AND (m.status = 'ended' OR m.end_time <= (NOW() AT TIME ZONE 'utc'))
ORDER BY
    CASE COALESCE(r.status, 'unknown') WHEN 'attending' THEN 0 WHEN 'leave' THEN 1 WHEN 'absent' THEN 2 ELSE 3 END,
    r.updated_at NULLS LAST,
    tm.joined_at,
    tm.user_id;

-- name: GetTeamMembershipState :one
SELECT credit_score, vip_until
FROM teams
WHERE id = $1;
