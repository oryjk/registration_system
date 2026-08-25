-- name: CreateNotification :one
INSERT INTO notifications (user_id, kind, title, content, related_type, related_id)
VALUES (sqlc.arg('user_id'), sqlc.arg('kind'), sqlc.arg('title'), sqlc.arg('content'),
        sqlc.narg('related_type'), sqlc.narg('related_id'))
RETURNING *;

-- name: ListNotifications :many
SELECT * FROM notifications
WHERE user_id = sqlc.arg('user_id')
  AND (sqlc.arg('unreadOnly')::boolean = FALSE OR read_at IS NULL)
ORDER BY id DESC
LIMIT sqlc.arg('limit_rows');

-- name: CountUnreadNotifications :one
SELECT COUNT(*) FROM notifications WHERE user_id = sqlc.arg('user_id') AND read_at IS NULL;

-- name: MarkAllNotificationsRead :execrows
UPDATE notifications SET read_at = NOW() WHERE user_id = sqlc.arg('user_id') AND read_at IS NULL;

-- name: MarkNotificationRead :execrows
UPDATE notifications SET read_at = NOW()
WHERE id = sqlc.arg('id') AND user_id = sqlc.arg('user_id') AND read_at IS NULL;
