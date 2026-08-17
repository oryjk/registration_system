-- name: GetLatestMiniReviewStatus :one
SELECT *
FROM mini_review_statuses
WHERE project_code = $1
ORDER BY version_code DESC, id DESC
LIMIT 1;

-- name: GetMiniReviewStatusByProjectAndVersion :one
SELECT *
FROM mini_review_statuses
WHERE project_code = $1
  AND version = $2;

-- name: GetMiniReviewStatusByID :one
SELECT *
FROM mini_review_statuses
WHERE id = $1;

-- name: CreateMiniReviewStatus :one
INSERT INTO mini_review_statuses (project_code, version, version_code, is_reviewing, status_text)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateMiniReviewStatusState :one
UPDATE mini_review_statuses
SET is_reviewing = $2,
    status_text = $3,
    updated_at = $4
WHERE id = $1
RETURNING *;

-- name: ListMiniReviewStatuses :many
SELECT *
FROM mini_review_statuses
WHERE project_code = COALESCE(sqlc.narg('project_code'), project_code)
ORDER BY updated_at DESC, id DESC
LIMIT sqlc.arg('limit_rows') OFFSET sqlc.arg('offset_rows');

-- name: CountMiniReviewStatuses :one
SELECT COUNT(*)
FROM mini_review_statuses
WHERE project_code = COALESCE(sqlc.narg('project_code'), project_code);
