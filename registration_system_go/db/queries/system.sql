-- name: GetMatchRegistrationDefault :one
SELECT players_per_team, min_players, max_players, updated_by_admin_id, created_at, updated_at
FROM match_registration_defaults
WHERE players_per_team = $1;

-- name: ListMatchRegistrationDefaults :many
SELECT players_per_team, min_players, max_players, updated_by_admin_id, created_at, updated_at
FROM match_registration_defaults
ORDER BY players_per_team;

-- name: UpsertMatchRegistrationDefault :one
INSERT INTO match_registration_defaults (
    players_per_team,
    min_players,
    max_players,
    updated_by_admin_id
)
VALUES ($1, $2, $3, $4)
ON CONFLICT (players_per_team) DO UPDATE
SET min_players = EXCLUDED.min_players,
    max_players = EXCLUDED.max_players,
    updated_by_admin_id = EXCLUDED.updated_by_admin_id,
    updated_at = NOW()
RETURNING players_per_team, min_players, max_players, updated_by_admin_id, created_at, updated_at;

-- name: GetMiniAppSetting :one
SELECT key, value, created_at, updated_at
FROM mini_app_settings
WHERE key = $1;

-- name: UpsertMiniAppSetting :one
INSERT INTO mini_app_settings (key, value)
VALUES ($1, $2)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW()
RETURNING key, value, created_at, updated_at;
