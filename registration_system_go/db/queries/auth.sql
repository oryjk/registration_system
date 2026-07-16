-- name: GetUserByOpenID :one
SELECT id, openid, nickname, avatar_url, real_name, phone_number, status, created_at, updated_at
FROM users
WHERE openid = $1;

-- name: GetUserByID :one
SELECT id, openid, nickname, avatar_url, real_name, phone_number, status, created_at, updated_at
FROM users
WHERE id = $1;

-- name: CreateUser :one
INSERT INTO users (openid, nickname, avatar_url)
VALUES ($1, $2, $3)
RETURNING id, openid, nickname, avatar_url, real_name, phone_number, status, created_at, updated_at;

-- name: UpdateUserProfile :one
UPDATE users
SET nickname = $2,
    avatar_url = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING id, openid, nickname, avatar_url, real_name, phone_number, status, created_at, updated_at;

-- name: UpdateUserBasicProfile :one
UPDATE users
SET real_name = $2,
    phone_number = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING id, openid, nickname, avatar_url, real_name, phone_number, status, created_at, updated_at;

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

-- name: CreateAdmin :one
INSERT INTO admin_users (username, password_hash, role, status)
VALUES ($1, $2, $3, $4)
RETURNING id, username, password_hash, role, status, created_at, updated_at;
