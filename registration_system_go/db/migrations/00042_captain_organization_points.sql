-- +goose Up
-- Separate snapshots avoid changing existing group/registration scan shapes.
-- A row marks rule v3: 6 attendance points and one fixed organizing point.
CREATE TABLE IF NOT EXISTS match_group_participation_rules (
    group_id UUID PRIMARY KEY REFERENCES match_registration_groups(id) ON DELETE CASCADE,
    organizer_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL
);

-- Capture every creation path, including the still-running previous backend.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION capture_match_group_participation_rule()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO match_group_participation_rules(group_id, organizer_user_id)
    SELECT NEW.id, t.captain_id FROM teams t WHERE t.id=NEW.team_id
    ON CONFLICT (group_id) DO NOTHING;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS capture_match_group_participation_rule ON match_registration_groups;
CREATE TRIGGER capture_match_group_participation_rule
AFTER INSERT ON match_registration_groups
FOR EACH ROW WHEN (NEW.kind IN ('host_team','guest_team') AND NEW.team_id IS NOT NULL)
EXECUTE FUNCTION capture_match_group_participation_rule();

-- Install the trigger before backfill: its table lock closes the concurrent
-- insertion gap while this migration runs against the live old backend.
-- Historical captain identities are unavailable: user-approved backfill uses
-- the current captain once, then preserves that attribution across transfers.
INSERT INTO match_group_participation_rules(group_id, organizer_user_id)
SELECT g.id, t.captain_id
FROM match_registration_groups g JOIN teams t ON t.id=g.team_id
WHERE g.kind IN ('host_team','guest_team')
ON CONFLICT (group_id) DO NOTHING;

-- Preserve all existing view columns/types/order, including the Down chain.
-- Aggregate captain attendance/response and organization into ONE group/user
-- row so existing joins never multiply records or attendance counts.
CREATE OR REPLACE VIEW team_participation_points AS
WITH eligible_groups AS (
    SELECT g.id AS group_id, g.match_id, g.team_id, m.start_time AS match_start_time,
           EXTRACT(YEAR FROM ((m.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai'))::integer AS score_year,
           rules.group_id AS rule_group_id, rules.organizer_user_id
    FROM match_registration_groups g
    JOIN matches m ON m.id=g.match_id
    LEFT JOIN match_group_participation_rules rules ON rules.group_id=g.id
    WHERE g.kind IN ('host_team','guest_team') AND g.team_id IS NOT NULL
      AND g.status<>'cancelled' AND m.status<>'cancelled'
      AND (m.status='ended' OR m.end_time <= (NOW() AT TIME ZONE 'UTC'))
      AND m.start_time < (((date_trunc('day',NOW() AT TIME ZONE 'Asia/Shanghai') + INTERVAL '1 day') AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC')
), facts AS (
    SELECT r.id AS registration_id, g.match_id, g.team_id, r.user_id, g.match_start_time, g.score_year,
           (CASE WHEN g.rule_group_id IS NOT NULL THEN 3 ELSE r.participation_rule_version END)::integer AS rule_version,
           (CASE WHEN r.status='attending' THEN
               CASE WHEN g.rule_group_id IS NOT NULL THEN 60 ELSE r.participation_base_points END
            ELSE 0 END)::bigint AS attendance_points,
           (CASE WHEN r.participation_confirmed_at IS NOT NULL THEN r.early_registration_bonus ELSE 0 END)::bigint AS response_points,
           g.group_id, 0::bigint AS organization_points
    FROM eligible_groups g JOIN match_registrations r ON r.group_id=g.group_id
    WHERE r.status='attending' OR (r.participation_confirmed_at IS NOT NULL AND r.early_registration_bonus>0)
    UNION ALL
    SELECT r.id, g.match_id, g.team_id, g.organizer_user_id, g.match_start_time, g.score_year,
           3::integer, 0::bigint, 0::bigint, g.group_id, 10::bigint
    FROM eligible_groups g
    LEFT JOIN match_registrations r ON r.group_id=g.group_id AND r.user_id=g.organizer_user_id
    WHERE g.organizer_user_id IS NOT NULL
)
SELECT MIN(registration_id::text)::uuid AS registration_id,
       match_id, team_id, user_id, match_start_time, score_year,
       SUM(attendance_points+response_points+organization_points)::bigint AS points,
       MAX(rule_version)::integer AS rule_version,
       SUM(attendance_points)::bigint AS attendance_points,
       SUM(response_points)::bigint AS response_points,
       group_id
FROM facts
GROUP BY group_id, match_id, team_id, user_id, match_start_time, score_year;

-- +goose Down
-- Roll back weights without deleting first-response facts or organizer snapshots.
CREATE OR REPLACE VIEW team_participation_points AS
SELECT r.id AS registration_id, g.match_id, g.team_id, r.user_id,
       m.start_time AS match_start_time,
       EXTRACT(YEAR FROM ((m.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai'))::integer AS score_year,
       (CASE WHEN r.status='attending' THEN r.participation_base_points ELSE 0 END
         + CASE WHEN r.participation_confirmed_at IS NOT NULL THEN r.early_registration_bonus ELSE 0 END)::bigint AS points,
       r.participation_rule_version AS rule_version,
       (CASE WHEN r.status='attending' THEN r.participation_base_points ELSE 0 END)::bigint AS attendance_points,
       (CASE WHEN r.participation_confirmed_at IS NOT NULL THEN r.early_registration_bonus ELSE 0 END)::bigint AS response_points,
       g.id AS group_id
FROM match_registrations r
JOIN match_registration_groups g ON g.id=r.group_id
JOIN matches m ON m.id=g.match_id
WHERE g.kind IN ('host_team','guest_team') AND g.team_id IS NOT NULL
  AND g.status<>'cancelled' AND m.status<>'cancelled'
  AND (r.status='attending' OR (r.participation_confirmed_at IS NOT NULL AND r.early_registration_bonus>0))
  AND (m.status='ended' OR m.end_time <= (NOW() AT TIME ZONE 'UTC'))
  AND m.start_time < (((date_trunc('day',NOW() AT TIME ZONE 'Asia/Shanghai') + INTERVAL '1 day') AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC');
