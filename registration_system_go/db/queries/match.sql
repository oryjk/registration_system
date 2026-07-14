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
    created_by_user_id
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15, $16
)
RETURNING *;

-- name: GetMatchByID :one
SELECT *
FROM matches
WHERE id = $1;

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
