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

-- name: GetMatchByIDForUpdate :one
SELECT *
FROM matches
WHERE id = $1
FOR UPDATE;

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

-- name: ListMatchesForUser :many
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
  AND (
      sqlc.arg('scope')::text = 'all'
      OR EXISTS (
          SELECT 1
          FROM match_registration_groups registration_group
          JOIN match_registrations registration ON registration.group_id = registration_group.id
          WHERE registration_group.match_id = m.id
            AND registration.user_id = sqlc.arg('user_id')
            AND registration.status <> 'cancelled'
      )
      OR EXISTS (
          SELECT 1
          FROM team_members membership
          WHERE membership.user_id = sqlc.arg('user_id')
            AND membership.status = 'active'
            AND (membership.team_id = m.host_team_id OR membership.team_id = m.away_team_id)
      )
  )
ORDER BY m.start_time DESC, m.id
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: CountMatchesForUser :one
SELECT COUNT(*)
FROM matches m
JOIN teams host ON host.id = m.host_team_id
WHERE (sqlc.narg('status')::text IS NULL OR m.status = sqlc.narg('status'))
  AND (
      sqlc.arg('search')::text = ''
      OR m.name ILIKE '%' || sqlc.arg('search') || '%'
      OR m.location ILIKE '%' || sqlc.arg('search') || '%'
      OR host.name ILIKE '%' || sqlc.arg('search') || '%'
  )
  AND (
      sqlc.arg('scope')::text = 'all'
      OR EXISTS (
          SELECT 1
          FROM match_registration_groups registration_group
          JOIN match_registrations registration ON registration.group_id = registration_group.id
          WHERE registration_group.match_id = m.id
            AND registration.user_id = sqlc.arg('user_id')
            AND registration.status <> 'cancelled'
      )
      OR EXISTS (
          SELECT 1
          FROM team_members membership
          WHERE membership.user_id = sqlc.arg('user_id')
            AND membership.status = 'active'
            AND (membership.team_id = m.host_team_id OR membership.team_id = m.away_team_id)
      )
  );

-- name: ListHomeActionMatchesForUser :many
SELECT m.*,
       host.name AS host_team_name,
       away.name AS away_team_name,
       related_group.id AS group_id,
       related_group.kind AS group_kind,
       related_group.team_id AS group_team_id,
       related_group.min_players AS group_min_players,
       related_group.max_players AS group_max_players,
       related_group.status AS group_status,
       related_group.created_at AS group_created_at,
       related_group.updated_at AS group_updated_at,
       related_group.cancelled_at AS group_cancelled_at,
       COALESCE((
           SELECT SUM(active.registration_count)
           FROM match_registrations active
           WHERE active.group_id = related_group.id
             AND active.status = 'attending'
       ), 0)::bigint AS attending_count,
       mine.id AS my_registration_id,
       mine.status AS my_registration_status,
       mine.registration_count AS my_registration_count,
       mine.created_at AS my_registration_created_at,
       mine.updated_at AS my_registration_updated_at,
       mine.cancelled_at AS my_registration_cancelled_at
FROM matches m
JOIN teams host ON host.id = m.host_team_id
LEFT JOIN teams away ON away.id = m.away_team_id
JOIN LATERAL (
    SELECT g.*
    FROM match_registration_groups g
    LEFT JOIN match_registrations own
      ON own.group_id = g.id
     AND own.user_id = sqlc.arg('user_id')
    WHERE g.match_id = m.id
      AND g.status <> 'cancelled'
      AND (
          own.id IS NOT NULL
          OR (
              g.team_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM team_members tm
                  WHERE tm.team_id = g.team_id
                    AND tm.user_id = sqlc.arg('user_id')
                    AND tm.status = 'active'
              )
          )
      )
    ORDER BY
        CASE WHEN own.id IS NOT NULL THEN 0 ELSE 1 END,
        CASE g.kind WHEN 'host_team' THEN 0 WHEN 'guest_team' THEN 1 ELSE 2 END,
        g.created_at,
        g.id
    LIMIT 1
) related_group ON TRUE
LEFT JOIN match_registrations mine
  ON mine.group_id = related_group.id
 AND mine.user_id = sqlc.arg('user_id')
WHERE m.status IN ('registering', 'ongoing')
ORDER BY
    CASE m.status WHEN 'ongoing' THEN 0 ELSE 1 END,
    m.start_time,
    m.id
LIMIT sqlc.arg('limit_count');

-- name: ListHomeEndedMatchesForUser :many
SELECT m.*,
       host.name AS host_team_name,
       away.name AS away_team_name
FROM matches m
JOIN teams host ON host.id = m.host_team_id
LEFT JOIN teams away ON away.id = m.away_team_id
WHERE m.status = 'ended'
  AND (
      EXISTS (
          SELECT 1
          FROM team_members tm
          WHERE tm.user_id = sqlc.arg('user_id')
            AND tm.status = 'active'
            AND (tm.team_id = m.host_team_id OR tm.team_id = m.away_team_id)
      )
      OR EXISTS (
          SELECT 1
          FROM match_registration_groups g
          JOIN match_registrations registration ON registration.group_id = g.id
          WHERE g.match_id = m.id
            AND registration.user_id = sqlc.arg('user_id')
      )
  )
ORDER BY m.start_time DESC, m.id
LIMIT sqlc.arg('limit_count');

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

-- name: DeleteMatch :execrows
DELETE FROM matches
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

-- name: GetActiveGuestGroupForUpdate :one
SELECT *
FROM match_registration_groups
WHERE match_id = $1
  AND kind = 'guest_team'
  AND status <> 'cancelled'
FOR UPDATE;

-- name: UpdateRegistrationGroupState :exec
UPDATE match_registration_groups
SET status = $2,
    cancelled_at = $3,
    updated_at = $4
WHERE id = $1;

-- name: GetRegistrationGroupForUpdate :one
SELECT *
FROM match_registration_groups
WHERE match_id = sqlc.arg('match_id')
  AND id = sqlc.arg('group_id')
FOR UPDATE;

-- name: GetUserRegistrationForUpdate :one
SELECT *
FROM match_registrations
WHERE group_id = sqlc.arg('group_id')
  AND user_id = sqlc.arg('user_id')
FOR UPDATE;

-- name: GetActiveUserRegistrationInMatchForUpdate :one
SELECT registration.*
FROM match_registrations registration
JOIN match_registration_groups registration_group
  ON registration_group.id = registration.group_id
WHERE registration_group.match_id = sqlc.arg('match_id')
  AND registration_group.status <> 'cancelled'
  AND registration.user_id = sqlc.arg('user_id')
  AND registration.status <> 'cancelled'
ORDER BY registration.created_at, registration.id
LIMIT 1
FOR UPDATE OF registration;

-- name: CountAttendingRegistrationsForGroup :one
SELECT COALESCE(SUM(registration_count), 0)::bigint
FROM match_registrations
WHERE group_id = $1
  AND status = 'attending';

-- name: IsActiveTeamMember :one
SELECT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = sqlc.arg('team_id')
      AND user_id = sqlc.arg('user_id')
      AND status = 'active'
);

-- name: SaveUserRegistration :exec
INSERT INTO match_registrations (
    id,
    group_id,
    user_id,
    status,
    registration_count,
    created_at,
    updated_at,
    cancelled_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (group_id, user_id) DO UPDATE
SET status = EXCLUDED.status,
    registration_count = EXCLUDED.registration_count,
    updated_at = EXCLUDED.updated_at,
    cancelled_at = EXCLUDED.cancelled_at;

-- name: ListRegistrationGroupStatesForUser :many
SELECT g.*,
       COALESCE((
           SELECT SUM(active.registration_count)
           FROM match_registrations active
           WHERE active.group_id = g.id
             AND active.status = 'attending'
       ), 0)::bigint AS attending_count,
       mine.id AS my_registration_id,
       mine.status AS my_registration_status,
       mine.registration_count AS my_registration_count,
       mine.created_at AS my_registration_created_at,
       mine.updated_at AS my_registration_updated_at,
       mine.cancelled_at AS my_registration_cancelled_at
FROM match_registration_groups g
LEFT JOIN match_registrations mine
    ON mine.group_id = g.id
   AND mine.user_id = sqlc.arg('user_id')
WHERE g.match_id = sqlc.arg('match_id')
ORDER BY g.created_at, g.id;

-- name: CreateRegistration :exec
INSERT INTO match_registrations (
    id,
    group_id,
    user_id,
    status,
    registration_count,
    created_at,
    updated_at
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7
);

-- name: ListTeamApplications :many
SELECT a.*, t.name AS applicant_team_name
FROM match_team_applications a
JOIN teams t ON t.id = a.applicant_team_id
WHERE a.match_id = $1
ORDER BY
    CASE a.status
        WHEN 'selected' THEN 0
        WHEN 'pending' THEN 1
        WHEN 'withdrawn' THEN 2
        ELSE 3
    END,
    a.created_at,
    a.id;

-- name: ListTeamApplicationsForManager :many
SELECT a.*, t.name AS applicant_team_name
FROM match_team_applications a
JOIN teams t ON t.id = a.applicant_team_id
JOIN team_members tm
  ON tm.team_id = a.applicant_team_id
 AND tm.user_id = sqlc.arg('user_id')
 AND tm.status = 'active'
 AND tm.role IN ('captain', 'leader')
WHERE a.match_id = sqlc.arg('match_id')
ORDER BY a.created_at, a.id;

-- name: GetTeamApplicationByIDForUpdate :one
SELECT *
FROM match_team_applications
WHERE match_id = $1
  AND id = $2
FOR UPDATE;

-- name: ListPendingTeamApplicationsForUpdate :many
SELECT *
FROM match_team_applications
WHERE match_id = $1
  AND status = 'pending'
ORDER BY created_at, id
FOR UPDATE;

-- name: CreateTeamApplication :exec
INSERT INTO match_team_applications (
    id,
    match_id,
    applicant_team_id,
    introduction,
    status,
    created_by_user_id,
    selected_at,
    withdrawn_at,
    created_at,
    updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);

-- name: UpdateTeamApplication :exec
UPDATE match_team_applications
SET status = $2,
    selected_at = $3,
    withdrawn_at = $4,
    updated_at = $5
WHERE id = $1;

-- name: UpdateMatchOpponent :exec
UPDATE matches
SET away_team_id = $2,
    opponent_state = $3,
    updated_at = $4
WHERE id = $1;

-- name: ListTeamGroupRoster :many
SELECT tm.user_id,
       tm.role AS member_role,
       u.nickname,
       u.avatar_url,
       u.real_name,
       r.status AS registration_status
FROM team_members tm
JOIN users u ON u.id = tm.user_id
LEFT JOIN match_registrations r
    ON r.group_id = $1
   AND r.user_id = tm.user_id
WHERE tm.team_id = $2
ORDER BY
    CASE COALESCE(r.status, 'unregistered')
        WHEN 'attending' THEN 0
        WHEN 'unknown' THEN 1
        WHEN 'unregistered' THEN 2
        WHEN 'leave' THEN 3
        WHEN 'absent' THEN 4
        ELSE 5
    END,
    CASE tm.role
        WHEN 'captain' THEN 0
        WHEN 'leader' THEN 1
        WHEN 'vice_captain' THEN 2
        ELSE 3
    END,
    tm.joined_at,
    tm.user_id;

-- name: ListIndividualGroupRegistrations :many
SELECT r.user_id,
       u.nickname,
       u.avatar_url,
       u.real_name,
       r.status AS registration_status
FROM match_registrations r
JOIN users u ON u.id = r.user_id
WHERE r.group_id = $1
ORDER BY
    CASE r.status
        WHEN 'attending' THEN 0
        WHEN 'unknown' THEN 1
        WHEN 'leave' THEN 3
        WHEN 'absent' THEN 4
        ELSE 5
    END,
    r.created_at,
    r.user_id;
