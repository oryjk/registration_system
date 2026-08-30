-- name: GetUserByOpenID :one
SELECT id, openid, nickname, avatar_url, real_name, phone_number, status, is_match_admin, created_at, updated_at
FROM users
WHERE openid = $1;

-- name: GetUserByID :one
SELECT id, openid, nickname, avatar_url, real_name, phone_number, status, is_match_admin, created_at, updated_at
FROM users
WHERE id = $1;

-- name: CreateUser :one
INSERT INTO users (openid, nickname, avatar_url)
VALUES ($1, $2, $3)
RETURNING id, openid, nickname, avatar_url, real_name, phone_number, status, is_match_admin, created_at, updated_at;

-- name: UpdateUserProfile :one
UPDATE users
SET nickname = $2,
    avatar_url = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING id, openid, nickname, avatar_url, real_name, phone_number, status, is_match_admin, created_at, updated_at;

-- name: UpdateUserBasicProfile :one
UPDATE users
SET real_name = $2,
    phone_number = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING id, openid, nickname, avatar_url, real_name, phone_number, status, is_match_admin, created_at, updated_at;

-- name: UpdateUserAppProfile :one
UPDATE users
SET nickname = $2,
    real_name = $3,
    avatar_url = $4,
    updated_at = NOW()
WHERE id = $1
RETURNING id, openid, nickname, avatar_url, real_name, phone_number, status, is_match_admin, created_at, updated_at;

-- name: SetUserMatchAdmin :one
-- 设置/取消比赛管理员标记（管理端操作）。
UPDATE users
SET is_match_admin = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING id, openid, nickname, avatar_url, real_name, phone_number, status, is_match_admin, created_at, updated_at;

-- name: ListUsersForAdmin :many
-- 管理端微信用户搜索：按昵称/姓名/手机号/用户 ID 模糊匹配，可只看比赛管理员。
SELECT id, openid, nickname, avatar_url, real_name, phone_number, status, is_match_admin, created_at, updated_at
FROM users
WHERE (
    sqlc.arg('search')::text = ''
    OR nickname ILIKE '%' || sqlc.arg('search')::text || '%'
    OR real_name ILIKE '%' || sqlc.arg('search')::text || '%'
    OR phone_number ILIKE '%' || sqlc.arg('search')::text || '%'
    OR id::text = sqlc.arg('search')::text
)
  AND (sqlc.narg('match_admin_only')::bool IS NULL OR is_match_admin = sqlc.narg('match_admin_only'))
ORDER BY id DESC
LIMIT sqlc.arg('limit_count') OFFSET sqlc.arg('offset_count');

-- name: CountUsersForAdmin :one
SELECT COUNT(*)
FROM users
WHERE (
    sqlc.arg('search')::text = ''
    OR nickname ILIKE '%' || sqlc.arg('search')::text || '%'
    OR real_name ILIKE '%' || sqlc.arg('search')::text || '%'
    OR phone_number ILIKE '%' || sqlc.arg('search')::text || '%'
    OR id::text = sqlc.arg('search')::text
)
  AND (sqlc.narg('match_admin_only')::bool IS NULL OR is_match_admin = sqlc.narg('match_admin_only'));

-- name: ListActiveTestLoginUsers :many
SELECT u.id,
       u.openid,
       u.nickname,
       u.avatar_url,
       u.real_name,
       u.phone_number,
       u.status,
       u.is_match_admin,
       u.created_at,
       u.updated_at,
       t.id AS team_id,
       t.name AS team_name,
       tm.role AS team_role
FROM users u
LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.status = 'active'
LEFT JOIN teams t ON t.id = tm.team_id AND t.status = 'active'
WHERE u.status = 'active'
ORDER BY u.id, t.id;

-- name: GetAdminByID :one
SELECT id, username, password_hash, role, status, created_at, updated_at
FROM admin_users
WHERE id = $1;

-- name: GetAdminByUsername :one
SELECT id, username, password_hash, role, status, created_at, updated_at
FROM admin_users
WHERE username = $1;

-- name: CountAdmins :one
SELECT COUNT(*) FROM admin_users;

-- name: ListAdmins :many
SELECT id, username, password_hash, role, status, created_at, updated_at
FROM admin_users
ORDER BY created_at DESC, id DESC;

-- name: CreateWebviewCode :one
INSERT INTO auth_webview_codes (user_id, code_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id, user_id, code_hash, expires_at, used_at, created_at;

-- name: ConsumeWebviewCode :one
-- 原子单次消费：未使用且未过期才置 used_at 并返回 user_id，否则无行返回。
UPDATE auth_webview_codes
SET used_at = NOW()
WHERE code_hash = $1 AND used_at IS NULL AND expires_at > NOW()
RETURNING user_id;

-- name: CreateAdmin :one
INSERT INTO admin_users (username, password_hash, role, status)
VALUES ($1, $2, $3, $4)
RETURNING id, username, password_hash, role, status, created_at, updated_at;
