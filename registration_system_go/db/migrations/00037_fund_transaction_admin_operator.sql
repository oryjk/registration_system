-- +goose Up
-- 后台管理员操作人追溯：管理员身份来自 admin_users，不能写入引用 users 的既有操作人列。
-- 新增独立外键列；历史流水保持双 NULL，不猜测、不回填历史操作人。
ALTER TABLE team_fund_transactions
    ADD COLUMN created_by_admin_id BIGINT NULL REFERENCES admin_users(id);

-- +goose Down
-- 仅删除列，不触碰任何流水记录；回滚后管理员操作人信息丢失但账目完整。
ALTER TABLE team_fund_transactions DROP COLUMN created_by_admin_id;
