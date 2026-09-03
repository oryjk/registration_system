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
    registration_start_at,
    registration_end_at,
    location,
    location_latitude,
    location_longitude,
    description,
    is_free,
    payment_mode,
    fee_per_person_cents,
    host_color,
    away_color,
    created_by_user_id,
    created_by_admin_id
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
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
	   COALESCE(host.name, '') AS host_team_name,
       away.name AS away_team_name,
       host.logo_url AS host_team_logo_url,
       away.logo_url AS away_team_logo_url
FROM matches m
LEFT JOIN teams host ON host.id = m.host_team_id
LEFT JOIN teams away ON away.id = m.away_team_id
WHERE m.id = $1;

-- name: ListMatchesForAdmin :many
SELECT m.*,
	   COALESCE(host.name, '') AS host_team_name,
       away.name AS away_team_name
FROM matches m
LEFT JOIN teams host ON host.id = m.host_team_id
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
LEFT JOIN teams host ON host.id = m.host_team_id
WHERE (sqlc.narg('status')::text IS NULL OR m.status = sqlc.narg('status'))
  AND (
      sqlc.arg('search')::text = ''
      OR m.name ILIKE '%' || sqlc.arg('search') || '%'
      OR m.location ILIKE '%' || sqlc.arg('search') || '%'
	      OR host.name ILIKE '%' || sqlc.arg('search') || '%'
	  );

-- name: ListMatchesForUser :many
SELECT m.*,
	   COALESCE(host.name, '') AS host_team_name,
       away.name AS away_team_name
FROM matches m
LEFT JOIN teams host ON host.id = m.host_team_id
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
      OR (
          sqlc.arg('scope')::text = 'mine'
          AND (
              EXISTS (
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
      )
      OR (
          sqlc.arg('scope')::text = 'others'
          AND NOT EXISTS (
              SELECT 1
              FROM match_registration_groups registration_group
              JOIN match_registrations registration ON registration.group_id = registration_group.id
              WHERE registration_group.match_id = m.id
                AND registration.user_id = sqlc.arg('user_id')
                AND registration.status <> 'cancelled'
          )
          AND NOT EXISTS (
              SELECT 1
              FROM team_members membership
              WHERE membership.user_id = sqlc.arg('user_id')
                AND membership.status = 'active'
                AND (membership.team_id = m.host_team_id OR membership.team_id = m.away_team_id)
          )
      )
  )
  AND (
      sqlc.narg('starts_after')::timestamp IS NULL
      OR m.start_time > sqlc.narg('starts_after')::timestamp
  )
  AND (
      sqlc.narg('ends_after')::timestamp IS NULL
      OR (m.end_time > sqlc.narg('ends_after')::timestamp AND m.status <> 'cancelled')
  )
  AND (
      sqlc.narg('host_team_only')::bool IS NULL
      OR (sqlc.narg('host_team_only')::bool AND m.host_team_id IS NOT NULL)
  )
  AND (
      cardinality(sqlc.arg('publication_modes')::text[]) = 0
      OR m.publication_mode = ANY(sqlc.arg('publication_modes')::text[])
  )
  AND (
      sqlc.narg('date_start')::timestamp IS NULL
      OR (
          m.start_time >= sqlc.narg('date_start')::timestamp
          AND m.start_time < sqlc.narg('date_start')::timestamp + INTERVAL '1 day'
      )
  )
ORDER BY m.start_time DESC, m.id
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: CountMatchesForUser :one
SELECT COUNT(*)
FROM matches m
LEFT JOIN teams host ON host.id = m.host_team_id
WHERE (sqlc.narg('status')::text IS NULL OR m.status = sqlc.narg('status'))
  AND (
      sqlc.arg('search')::text = ''
      OR m.name ILIKE '%' || sqlc.arg('search') || '%'
      OR m.location ILIKE '%' || sqlc.arg('search') || '%'
      OR host.name ILIKE '%' || sqlc.arg('search') || '%'
  )
  AND (
      sqlc.arg('scope')::text = 'all'
      OR (
          sqlc.arg('scope')::text = 'mine'
          AND (
              EXISTS (
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
      )
      OR (
          sqlc.arg('scope')::text = 'others'
          AND NOT EXISTS (
              SELECT 1
              FROM match_registration_groups registration_group
              JOIN match_registrations registration ON registration.group_id = registration_group.id
              WHERE registration_group.match_id = m.id
                AND registration.user_id = sqlc.arg('user_id')
                AND registration.status <> 'cancelled'
          )
          AND NOT EXISTS (
              SELECT 1
              FROM team_members membership
              WHERE membership.user_id = sqlc.arg('user_id')
                AND membership.status = 'active'
                AND (membership.team_id = m.host_team_id OR membership.team_id = m.away_team_id)
          )
      )
  )
  AND (
      sqlc.narg('starts_after')::timestamp IS NULL
      OR m.start_time > sqlc.narg('starts_after')::timestamp
  )
  AND (
      sqlc.narg('ends_after')::timestamp IS NULL
      OR (m.end_time > sqlc.narg('ends_after')::timestamp AND m.status <> 'cancelled')
  )
  AND (
      sqlc.narg('host_team_only')::bool IS NULL
      OR (sqlc.narg('host_team_only')::bool AND m.host_team_id IS NOT NULL)
  )
  AND (
      cardinality(sqlc.arg('publication_modes')::text[]) = 0
      OR m.publication_mode = ANY(sqlc.arg('publication_modes')::text[])
  )
  AND (
      sqlc.narg('date_start')::timestamp IS NULL
      OR (
          m.start_time >= sqlc.narg('date_start')::timestamp
          AND m.start_time < sqlc.narg('date_start')::timestamp + INTERVAL '1 day'
      )
  );

-- name: ListHomeActionMatchesForUser :many
SELECT m.*,
	   COALESCE(host.name, '') AS host_team_name,
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
LEFT JOIN teams host ON host.id = m.host_team_id
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
  AND m.end_time > NOW()
ORDER BY
    CASE m.status WHEN 'ongoing' THEN 0 ELSE 1 END,
    m.start_time,
    m.id
LIMIT sqlc.arg('limit_count');

-- name: ListHomeEndedMatchesForUser :many
SELECT m.*,
	   COALESCE(host.name, '') AS host_team_name,
       away.name AS away_team_name
FROM matches m
LEFT JOIN teams host ON host.id = m.host_team_id
LEFT JOIN teams away ON away.id = m.away_team_id
WHERE m.status <> 'cancelled'
  AND (m.status = 'ended' OR m.end_time <= NOW())
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
ORDER BY m.end_time DESC, m.id
LIMIT sqlc.arg('limit_count');

-- name: ListHomeActionGroupParticipants :many
-- 首页比赛卡片的报名人头像列表：一次性按 group 批量取全部 attending 报名者，
-- 按报名先后（created_at, user_id）排序，避免 N+1 查询。
SELECT r.group_id,
       r.user_id,
       u.nickname,
       u.avatar_url,
       r.status
FROM match_registrations r
JOIN users u ON u.id = r.user_id
WHERE r.group_id = ANY(sqlc.arg('group_ids')::uuid[])
  AND r.status = 'attending'
ORDER BY r.group_id, r.created_at, r.user_id;

-- name: ListHomeEndedMatchParticipants :many
-- 首页已结束比赛卡片的报名人头像列表：一次性按 match 批量取全部 attending 报名者，
-- 合并该比赛全部报名组后按报名先后（created_at, user_id）排序，避免 N+1 查询。
SELECT g.match_id,
       r.user_id,
       u.nickname,
       u.avatar_url,
       r.status
FROM match_registration_groups g
JOIN match_registrations r ON r.group_id = g.id
JOIN users u ON u.id = r.user_id
WHERE g.match_id = ANY(sqlc.arg('match_ids')::uuid[])
  AND g.status <> 'cancelled'
  AND r.status = 'attending'
ORDER BY g.match_id, r.created_at, r.user_id;

-- name: UpdateMatchDetails :one
UPDATE matches
SET name = $2,
    start_time = $3,
    end_time = $4,
    registration_start_at = $5,
    registration_end_at = $6,
    location = $7,
    location_latitude = $8,
    location_longitude = $9,
    description = $10,
    opponent_name = $11,
    host_color = $12,
    away_color = $13,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateMatchStatus :one
UPDATE matches
SET status = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: FinishMatchStatus :execrows
-- 用户端收尾专用条件更新：旧状态仍是非终态才写入，
-- 防止主/客队并发收尾时后写者覆盖先到的终态。
UPDATE matches
SET status = $2,
    updated_at = NOW()
WHERE id = $1
  AND status IN ('registering', 'ongoing');

-- name: UpdateMatchScore :one
-- 录入/修正比赛比分（进行中或已结束）；状态约束在 application 层校验。
UPDATE matches
SET host_score = $2,
    away_score = $3,
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

-- name: UpdateRegistrationGroupCapacity :exec
UPDATE match_registration_groups
SET max_players = $2,
    updated_at = $3
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

-- name: ListRegistrationSummariesForMatches :many
SELECT g.match_id,
       g.id AS group_id,
       g.kind,
       g.team_id,
       g.min_players,
       g.max_players,
       COALESCE(SUM(r.registration_count) FILTER (WHERE r.status = 'attending'), 0)::bigint AS attending_count
FROM match_registration_groups g
LEFT JOIN match_registrations r ON r.group_id = g.id
WHERE g.match_id = ANY(sqlc.arg('match_ids')::uuid[])
  AND g.status <> 'cancelled'
GROUP BY g.match_id, g.id, g.kind, g.team_id, g.min_players, g.max_players
ORDER BY g.match_id, g.id;

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
       mine.paid AS my_registration_paid,
       mine.created_at AS my_registration_created_at,
       mine.updated_at AS my_registration_updated_at,
       mine.cancelled_at AS my_registration_cancelled_at
FROM match_registration_groups g
LEFT JOIN match_registrations mine
    ON mine.group_id = g.id
   AND mine.user_id = sqlc.arg('user_id')
WHERE g.match_id = sqlc.arg('match_id')
ORDER BY g.created_at, g.id;

-- name: MarkRegistrationPaidByMatchUser :execrows
-- 报名费订单核销后标记报名已支付；幂等，重复调用无副作用。
UPDATE match_registrations r
SET paid = TRUE
FROM match_registration_groups g
WHERE r.group_id = g.id
  AND g.match_id = $1
  AND r.user_id = $2
  AND r.status <> 'cancelled';

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

-- name: ListGroupRegistrations :many
-- 报名组的全部报名记录（含用户资料）；个人组花名册与用户端详情 participants 共用。
SELECT r.user_id,
       u.nickname,
       u.avatar_url,
       u.real_name,
       r.status AS registration_status,
       r.registration_count,
       r.paid,
       r.created_at AS registered_at
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

-- name: ListSettlementAttendees :many
-- 结算名单候选：出场报名者及其所属组球队（散人组 team_id 为 NULL）、预付标记。
SELECT r.user_id,
       u.nickname,
       g.id   AS group_id,
       g.team_id,
       r.paid
FROM match_registrations r
JOIN match_registration_groups g ON g.id = r.group_id
JOIN users u ON u.id = r.user_id
WHERE g.match_id = sqlc.arg('match_id')
  AND r.status = 'attending'
  AND g.status <> 'cancelled'
ORDER BY g.kind, r.created_at, r.user_id;

-- ============ 队长留言（match_captain_messages） ============

-- name: AppendCaptainMessage :exec
INSERT INTO match_captain_messages (
    id, match_id, team_id, thread_owner_user_id, sender_user_id, content
) VALUES (
    sqlc.arg('id'), sqlc.arg('match_id'), sqlc.arg('team_id'),
    sqlc.arg('thread_owner_user_id'), sqlc.arg('sender_user_id'),
    sqlc.arg('content')
);

-- name: FindCaptainThreadHead :one
-- 串首条消息：thread_id 即首条消息 id，携带串的归属信息用于权限判定。
SELECT m.id, m.match_id, m.team_id, m.thread_owner_user_id, m.sender_user_id, m.content, m.created_at,
       match.name AS match_name,
       host.name AS host_team_name
FROM match_captain_messages m
JOIN matches match ON match.id = m.match_id
JOIN teams host ON host.id = m.team_id
WHERE m.id = sqlc.arg('id');

-- name: FindCaptainThreadByOwner :one
-- 发起人是否已在该比赛下开过串（同一场比赛同一发起人只保留一串）。
SELECT m.id, m.match_id, m.team_id, m.thread_owner_user_id, m.sender_user_id, m.content, m.created_at,
       match.name AS match_name,
       host.name AS host_team_name
FROM match_captain_messages m
JOIN matches match ON match.id = m.match_id
JOIN teams host ON host.id = m.team_id
WHERE m.match_id = sqlc.arg('match_id')
  AND m.thread_owner_user_id = sqlc.arg('thread_owner_user_id')
ORDER BY m.created_at ASC, m.id ASC
LIMIT 1;

-- name: ListCaptainMessagesByThread :many
SELECT m.id, m.sender_user_id, m.content, m.created_at,
       u.nickname AS sender_nickname,
       u.avatar_url AS sender_avatar_url,
       (m.sender_user_id <> m.thread_owner_user_id) AS sender_is_captain_side
FROM match_captain_messages m
JOIN users u ON u.id = m.sender_user_id
WHERE m.match_id = sqlc.arg('match_id')
  AND m.thread_owner_user_id = sqlc.arg('thread_owner_user_id')
ORDER BY m.created_at ASC, m.id ASC;

-- name: ListMyCaptainMessageThreads :many
-- 我的对话列表：我发起的串 ∪ 我任 captain/leader 球队收到的串；
-- DISTINCT ON 按串取最新一条，外层按最新消息时间倒序分页。
SELECT *
FROM (
    SELECT DISTINCT ON (m.match_id, m.thread_owner_user_id)
           (SELECT head.id FROM match_captain_messages head
             WHERE head.match_id = m.match_id AND head.thread_owner_user_id = m.thread_owner_user_id
             ORDER BY head.created_at ASC, head.id ASC LIMIT 1) AS thread_id,
           m.match_id,
           m.team_id,
           m.thread_owner_user_id,
           match.name AS match_name,
           host.name AS host_team_name,
           owner.nickname AS owner_nickname,
           owner.avatar_url AS owner_avatar_url,
           m.sender_user_id AS latest_sender_user_id,
           (m.sender_user_id <> m.thread_owner_user_id) AS latest_sender_is_captain_side,
           m.content AS latest_content,
           m.created_at AS latest_created_at,
           (SELECT COUNT(*) FROM match_captain_messages unread
             WHERE unread.match_id = m.match_id
               AND unread.thread_owner_user_id = m.thread_owner_user_id
               AND unread.sender_user_id <> sqlc.arg('user_id')
               AND unread.created_at > COALESCE(reads.last_read_at, '-infinity'::timestamptz))::bigint AS unread_count
    FROM match_captain_messages m
    JOIN matches match ON match.id = m.match_id
    JOIN teams host ON host.id = m.team_id
    JOIN users owner ON owner.id = m.thread_owner_user_id
    LEFT JOIN match_captain_thread_reads reads
      ON reads.thread_id = (
          SELECT head.id FROM match_captain_messages head
          WHERE head.match_id = m.match_id AND head.thread_owner_user_id = m.thread_owner_user_id
          ORDER BY head.created_at ASC, head.id ASC LIMIT 1
      ) AND reads.user_id = sqlc.arg('user_id')
    WHERE m.thread_owner_user_id = sqlc.arg('user_id')
       OR m.team_id IN (
           SELECT tm.team_id
           FROM team_members tm
           WHERE tm.user_id = sqlc.arg('user_id')
             AND tm.role IN ('captain', 'leader')
             AND tm.status = 'active'
       )
    ORDER BY m.match_id, m.thread_owner_user_id, m.created_at DESC, m.id DESC
) threads
ORDER BY threads.latest_created_at DESC, threads.thread_id
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: CountMyUnreadCaptainMessages :one
-- 我的留言未读总数：全部可见串内对方发送且晚于我阅读进度的消息数。
SELECT COALESCE(SUM(unread), 0)::bigint FROM (
    SELECT (
        SELECT COUNT(*) FROM match_captain_messages unread
        WHERE unread.match_id = m.match_id
          AND unread.thread_owner_user_id = m.thread_owner_user_id
          AND unread.sender_user_id <> sqlc.arg('user_id')
          AND unread.created_at > COALESCE(reads.last_read_at, '-infinity'::timestamptz)
    ) AS unread
    FROM match_captain_messages m
    LEFT JOIN match_captain_thread_reads reads
      ON reads.thread_id = (
          SELECT head.id FROM match_captain_messages head
          WHERE head.match_id = m.match_id AND head.thread_owner_user_id = m.thread_owner_user_id
          ORDER BY head.created_at ASC, head.id ASC LIMIT 1
      ) AND reads.user_id = sqlc.arg('user_id')
    WHERE m.thread_owner_user_id = sqlc.arg('user_id')
       OR m.team_id IN (
           SELECT tm.team_id
           FROM team_members tm
           WHERE tm.user_id = sqlc.arg('user_id')
             AND tm.role IN ('captain', 'leader')
             AND tm.status = 'active'
       )
    GROUP BY m.match_id, m.thread_owner_user_id, reads.last_read_at
) threads;

-- name: UpsertCaptainThreadRead :exec
-- 记录阅读进度：按 (match, owner) 归位到串首条消息 id，只前进不回退（GREATEST）。
INSERT INTO match_captain_thread_reads (thread_id, user_id, last_read_at)
VALUES ((
    SELECT head.id FROM match_captain_messages head
    WHERE head.match_id = sqlc.arg('match_id') AND head.thread_owner_user_id = sqlc.arg('thread_owner_user_id')
    ORDER BY head.created_at ASC, head.id ASC LIMIT 1
  ), sqlc.arg('user_id'), sqlc.arg('last_read_at'))
ON CONFLICT (thread_id, user_id)
DO UPDATE SET last_read_at = GREATEST(match_captain_thread_reads.last_read_at, EXCLUDED.last_read_at);

-- name: CountMyCaptainMessageThreads :one
SELECT COUNT(*) FROM (
    SELECT DISTINCT m.match_id, m.thread_owner_user_id
    FROM match_captain_messages m
    WHERE m.thread_owner_user_id = sqlc.arg('user_id')
       OR m.team_id IN (
           SELECT tm.team_id
           FROM team_members tm
           WHERE tm.user_id = sqlc.arg('user_id')
             AND tm.role IN ('captain', 'leader')
             AND tm.status = 'active'
       )
) threads;

-- name: ListTeamManagerUserIDs :many
-- 队长留言通知目标：该队全部在任 captain/leader。
SELECT tm.user_id
FROM team_members tm
WHERE tm.team_id = sqlc.arg('team_id')
  AND tm.role IN ('captain', 'leader')
  AND tm.status = 'active'
ORDER BY tm.user_id;

-- name: GetTeamCaptainProfile :one
-- 用户端比赛详情的主队队长资料（无队长时无行）。
SELECT u.id AS user_id, u.nickname, u.avatar_url
FROM teams t
JOIN users u ON u.id = t.captain_id
WHERE t.id = sqlc.arg('team_id');

-- name: GetUserBrief :one
-- 留言通知与串装配所需的用户摘要。
SELECT u.id AS user_id, u.nickname, u.avatar_url
FROM users u
WHERE u.id = sqlc.arg('user_id');
