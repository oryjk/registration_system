-- name: ListVenueSuggestions :many
WITH aggregated AS (
    SELECT btrim(m.location)::TEXT AS name,
           COUNT(*)::BIGINT AS use_count,
           MAX(m.start_time)::TIMESTAMPTZ AS last_used_at,
           (ARRAY_REMOVE(ARRAY_AGG(m.location_latitude ORDER BY m.start_time DESC NULLS LAST), NULL))[1]::DOUBLE PRECISION AS latitude,
           (ARRAY_REMOVE(ARRAY_AGG(m.location_longitude ORDER BY m.start_time DESC NULLS LAST), NULL))[1]::DOUBLE PRECISION AS longitude
    FROM matches m
    WHERE m.location IS NOT NULL AND btrim(m.location) <> ''
    GROUP BY btrim(m.location)
    HAVING COUNT(m.location_latitude) > 0
)
SELECT a.name, a.latitude, a.longitude, a.use_count, a.last_used_at,
       COALESCE(v.image_url, '') AS image_url
FROM aggregated a
LEFT JOIN venues v ON v.name = a.name
ORDER BY a.use_count DESC, a.last_used_at DESC
LIMIT sqlc.arg('limit_count');

-- name: ListVenueMap :many
WITH located AS (
    SELECT DISTINCT ON (btrim(m.location))
           btrim(m.location)::TEXT AS name,
           m.location_latitude::DOUBLE PRECISION AS latitude,
           m.location_longitude::DOUBLE PRECISION AS longitude,
           COUNT(*) OVER (PARTITION BY btrim(m.location))::BIGINT AS use_count,
           m.start_time::TIMESTAMPTZ AS last_used_at
    FROM matches m
    WHERE m.location IS NOT NULL AND btrim(m.location) <> ''
      AND m.location_latitude BETWEEN -90 AND 90
      AND m.location_longitude BETWEEN -180 AND 180
    ORDER BY btrim(m.location), m.start_time DESC NULLS LAST, m.id DESC
)
SELECT l.name, l.latitude, l.longitude, l.use_count, l.last_used_at,
       COALESCE(v.image_url, '') AS image_url
FROM located l
LEFT JOIN venues v ON v.name = l.name
ORDER BY l.name;

-- name: SetVenueImage :exec
INSERT INTO venues (name, image_url)
VALUES (sqlc.arg('name'), sqlc.arg('image_url'))
ON CONFLICT (name) DO UPDATE
SET image_url = EXCLUDED.image_url,
    updated_at = now();
