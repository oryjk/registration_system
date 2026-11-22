-- +goose Up
-- 比赛球服裤/袜配色、自定义分享背景、球队会员单次权益及球队分享背景资源库（全部加法/放宽约束，兼容运行中的旧镜像）。

ALTER TABLE matches
    ADD COLUMN host_shorts_color VARCHAR(16) NULL,
    ADD COLUMN host_socks_color VARCHAR(16) NULL,
    ADD COLUMN away_shorts_color VARCHAR(16) NULL,
    ADD COLUMN away_socks_color VARCHAR(16) NULL,
    ADD COLUMN share_bg_image_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN share_bg_unlocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE teams
    ADD COLUMN vip_credits INT NOT NULL DEFAULT 0,
    ADD COLUMN default_share_bg_url TEXT NOT NULL DEFAULT '',
    ADD CONSTRAINT teams_vip_credits_non_negative CHECK (vip_credits >= 0);

CREATE TABLE team_share_backgrounds (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    uploaded_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT team_share_backgrounds_image_url_not_blank CHECK (BTRIM(image_url) <> ''),
    CONSTRAINT team_share_backgrounds_team_image_unique UNIQUE (team_id, image_url)
);

CREATE INDEX team_share_backgrounds_team_created_idx
    ON team_share_backgrounds (team_id, created_at DESC, id DESC);

ALTER TABLE payment_orders
    DROP CONSTRAINT payment_orders_kind_check,
    ADD CONSTRAINT payment_orders_kind_check CHECK (
        kind IN ('recharge', 'team_membership', 'match_registration', 'tip', 'team_vip')
    ),
    ADD COLUMN vip_plan VARCHAR(16) NULL,
    ADD CONSTRAINT payment_orders_team_vip_shape_check CHECK (
        (kind = 'team_vip' AND team_id IS NOT NULL AND vip_plan IN ('once', 'monthly', 'yearly'))
        OR (kind <> 'team_vip' AND vip_plan IS NULL)
    );

-- +goose Down
ALTER TABLE payment_orders
    DROP CONSTRAINT payment_orders_team_vip_shape_check,
    DROP COLUMN vip_plan,
    DROP CONSTRAINT payment_orders_kind_check,
    ADD CONSTRAINT payment_orders_kind_check CHECK (
        kind IN ('recharge', 'team_membership', 'match_registration', 'tip')
    );

DROP TABLE IF EXISTS team_share_backgrounds;

ALTER TABLE teams
    DROP CONSTRAINT teams_vip_credits_non_negative,
    DROP COLUMN default_share_bg_url,
    DROP COLUMN vip_credits;

ALTER TABLE matches
    DROP COLUMN share_bg_unlocked,
    DROP COLUMN share_bg_image_url,
    DROP COLUMN away_socks_color,
    DROP COLUMN away_shorts_color,
    DROP COLUMN host_socks_color,
    DROP COLUMN host_shorts_color;
