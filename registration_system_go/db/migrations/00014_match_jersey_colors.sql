-- +goose Up
-- 比赛球服颜色：主队/客队各自可选一个 #RRGGBB 颜色，空值表示未设置。
ALTER TABLE matches
    ADD COLUMN host_color TEXT NULL,
    ADD COLUMN away_color TEXT NULL;

-- +goose Down
ALTER TABLE matches
    DROP COLUMN away_color,
    DROP COLUMN host_color;
