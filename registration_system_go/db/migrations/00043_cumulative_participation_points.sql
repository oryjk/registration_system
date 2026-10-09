-- +goose Up
-- Annual records and rankings retain their existing meaning. Activity levels
-- use a separate all-year total scoped to the registration group's team.
CREATE VIEW team_cumulative_participation_totals AS
SELECT team_id, user_id, SUM(participation_points)::bigint AS participation_points
FROM team_participation_totals
GROUP BY team_id, user_id;

-- +goose Down
-- No scoring facts or annual records are deleted.
DROP VIEW team_cumulative_participation_totals;
