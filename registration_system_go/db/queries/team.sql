-- name: GetTeamByID :one
SELECT id, name, description, logo_url, captain_id, status, created_at, updated_at
FROM teams
WHERE id = $1;

-- name: CreateTeam :one
INSERT INTO teams (name, description, status)
VALUES ($1, $2, 'active')
RETURNING id, name, description, logo_url, captain_id, status, created_at, updated_at;

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
RETURNING id, name, description, logo_url, captain_id, status, created_at, updated_at;

-- name: DeleteTeam :execrows
DELETE FROM teams
WHERE id = $1;
