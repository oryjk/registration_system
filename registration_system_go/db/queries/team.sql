-- name: GetTeamByID :one
SELECT id, name, description, logo_url, captain_id, status, created_at, updated_at
FROM teams
WHERE id = $1;

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
