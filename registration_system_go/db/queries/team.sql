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
SELECT id, name, description, logo_url, captain_id, status, created_at, updated_at
FROM teams
WHERE sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text
ORDER BY name, id;

-- name: UpdateTeam :one
UPDATE teams
SET name = $2,
    description = $3,
    status = $4,
    updated_at = NOW()
WHERE id = $1
RETURNING teams.id, teams.name, teams.description, teams.logo_url, teams.captain_id, teams.status, teams.created_at, teams.updated_at;

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
