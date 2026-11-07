-- +goose Up
-- 场馆组局：场馆账号发布的无主队比赛，分甲、乙两边，每边由一支球队或散人填满。
-- 全部为加法或放宽，已有比赛的 side 为空，线上旧镜像不受影响。
ALTER TABLE users
    ADD COLUMN is_venue BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE match_registration_groups
    ADD COLUMN side VARCHAR(1) NULL,
    ADD CONSTRAINT match_registration_groups_side_check CHECK (side IS NULL OR side IN ('a', 'b'));

DROP INDEX match_registration_groups_active_kind_unique;
CREATE UNIQUE INDEX match_registration_groups_active_kind_unique
    ON match_registration_groups (match_id, kind)
    WHERE status <> 'cancelled' AND side IS NULL;

CREATE UNIQUE INDEX match_registration_groups_active_side_unique
    ON match_registration_groups (match_id, side)
    WHERE status <> 'cancelled' AND side IS NOT NULL;

ALTER TABLE matches
    DROP CONSTRAINT matches_publication_mode_check,
    ADD CONSTRAINT matches_publication_mode_check CHECK (
        publication_mode IN ('offline_confirmed', 'online_team', 'online_individual', 'online_pickup', 'venue_hosted')
    ),
    DROP CONSTRAINT matches_host_team_presence_check,
    ADD CONSTRAINT matches_host_team_presence_check CHECK (
        (publication_mode IN ('online_pickup', 'venue_hosted') AND host_team_id IS NULL)
        OR (publication_mode NOT IN ('online_pickup', 'venue_hosted') AND host_team_id IS NOT NULL)
    );

-- +goose Down
-- 注意：回滚前需先清理场馆组局比赛及其报名数据，否则约束和索引会因残留数据失败。
ALTER TABLE matches
    DROP CONSTRAINT matches_host_team_presence_check,
    ADD CONSTRAINT matches_host_team_presence_check CHECK (
        (publication_mode = 'online_pickup' AND host_team_id IS NULL)
        OR (publication_mode <> 'online_pickup' AND host_team_id IS NOT NULL)
    ),
    DROP CONSTRAINT matches_publication_mode_check,
    ADD CONSTRAINT matches_publication_mode_check CHECK (
        publication_mode IN ('offline_confirmed', 'online_team', 'online_individual', 'online_pickup')
    );

DROP INDEX match_registration_groups_active_side_unique;
DROP INDEX match_registration_groups_active_kind_unique;
CREATE UNIQUE INDEX match_registration_groups_active_kind_unique
    ON match_registration_groups (match_id, kind)
    WHERE status <> 'cancelled';

ALTER TABLE match_registration_groups
    DROP CONSTRAINT match_registration_groups_side_check,
    DROP COLUMN side;

ALTER TABLE users
    DROP COLUMN is_venue;
