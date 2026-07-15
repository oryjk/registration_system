-- name: CreateMatch :one
INSERT INTO matches (
    id,
    name,
    publication_mode,
    opponent_state,
    status,
    host_team_id,
    away_team_id,
    opponent_name,
    players_per_team,
    start_time,
    end_time,
    location,
    location_latitude,
    location_longitude,
    description,
    created_by_user_id,
    created_by_admin_id
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15, $16, $17
)
RETURNING *;

-- name: GetMatchByID :one
SELECT *
FROM matches
WHERE id = $1;

-- name: GetMatchForAdmin :one
SELECT m.*,
       host.name AS host_team_name,
       away.name AS away_team_name
FROM matches m
JOIN teams host ON host.id = m.host_team_id
LEFT JOIN teams away ON away.id = m.away_team_id
WHERE m.id = $1;

-- name: ListMatchesForAdmin :many
SELECT m.*,
       host.name AS host_team_name,
       away.name AS away_team_name
FROM matches m
JOIN teams host ON host.id = m.host_team_id
LEFT JOIN teams away ON away.id = m.away_team_id
WHERE (sqlc.narg('status')::text IS NULL OR m.status = sqlc.narg('status'))
  AND (
      sqlc.arg('search')::text = ''
      OR m.name ILIKE '%' || sqlc.arg('search') || '%'
      OR m.location ILIKE '%' || sqlc.arg('search') || '%'
      OR host.name ILIKE '%' || sqlc.arg('search') || '%'
  )
ORDER BY m.start_time DESC, m.id
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: CountMatchesForAdmin :one
SELECT COUNT(*)
FROM matches m
JOIN teams host ON host.id = m.host_team_id
WHERE (sqlc.narg('status')::text IS NULL OR m.status = sqlc.narg('status'))
  AND (
      sqlc.arg('search')::text = ''
      OR m.name ILIKE '%' || sqlc.arg('search') || '%'
      OR m.location ILIKE '%' || sqlc.arg('search') || '%'
      OR host.name ILIKE '%' || sqlc.arg('search') || '%'
  );

-- name: UpdateMatchDetails :one
UPDATE matches
SET name = $2,
    start_time = $3,
    end_time = $4,
    location = $5,
    location_latitude = $6,
    location_longitude = $7,
    description = $8,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchStatus :one
UPDATE matches
SET status = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: CreateRegistrationGroup :one
INSERT INTO match_registration_groups (
    id,
    match_id,
    kind,
    team_id,
    min_players,
    max_players,
    status
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListRegistrationGroupsByMatchID :many
SELECT *
FROM match_registration_groups
WHERE match_id = $1
ORDER BY created_at, id;
