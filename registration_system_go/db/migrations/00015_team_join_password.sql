-- +goose Up
-- 用户侧创建球队时可设置入队口令，加入球队需校验；存 bcrypt 哈希，空表示无口令。
ALTER TABLE teams
    ADD COLUMN join_password_hash TEXT NULL;

-- +goose Down
ALTER TABLE teams
    DROP COLUMN join_password_hash;
