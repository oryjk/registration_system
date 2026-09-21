-- +goose Up
-- 队内报名（host_team 组）的成行线 = 每队人数，随创建比赛直接落库。
-- 放宽 shape_check 允许 host_team 组携带 min_players；存量行保持 NULL，
-- 展示侧回落「人制」口径不变。guest_team（接约）组维持不设成行线。

ALTER TABLE match_registration_groups
    DROP CONSTRAINT match_registration_groups_shape_check,
    ADD CONSTRAINT match_registration_groups_shape_check CHECK (
        (
            kind = 'host_team'
            AND team_id IS NOT NULL
        )
        OR
        (
            kind = 'guest_team'
            AND team_id IS NOT NULL
            AND min_players IS NULL
        )
        OR
        (
            kind = 'individual_opponent'
            AND team_id IS NULL
            AND min_players IS NOT NULL
            AND max_players IS NOT NULL
        )
    );

-- 回填存量队内报名组成行线；上限小于人制的老数据（人制与上限矛盾）保持 NULL，
-- 避免 min > max 触发 limits_check，展示侧仍走「人制」回落。
UPDATE match_registration_groups g
SET min_players = m.players_per_team
FROM matches m
WHERE g.match_id = m.id
  AND g.kind = 'host_team'
  AND g.min_players IS NULL
  AND (g.max_players IS NULL OR g.max_players >= m.players_per_team);

-- +goose Down
-- 先清空 host_team 组的 min_players，否则旧约束会因残留数据失败。
UPDATE match_registration_groups SET min_players = NULL WHERE kind = 'host_team';
ALTER TABLE match_registration_groups
    DROP CONSTRAINT match_registration_groups_shape_check,
    ADD CONSTRAINT match_registration_groups_shape_check CHECK (
        (
            kind IN ('host_team', 'guest_team')
            AND team_id IS NOT NULL
            AND min_players IS NULL
        )
        OR
        (
            kind = 'individual_opponent'
            AND team_id IS NULL
            AND min_players IS NOT NULL
            AND max_players IS NOT NULL
        )
    );
