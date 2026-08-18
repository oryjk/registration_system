-- +goose Up
-- 队费余额从球队维度改为"个人在球队内的账户"维度：
-- 队费由谁缴纳就计入谁的 team_members.balance_cents。
-- 已有 teams.balance_cents 的存量并入该队队长（唯一有缴纳权限的角色）名下。
ALTER TABLE team_members
    ADD COLUMN balance_cents BIGINT NOT NULL DEFAULT 0;

UPDATE team_members tm
SET balance_cents = t.balance_cents
FROM teams t
WHERE t.id = tm.team_id
  AND t.balance_cents > 0
  AND tm.role = 'captain';

ALTER TABLE teams
    DROP COLUMN balance_cents;

-- +goose Down
ALTER TABLE teams
    ADD COLUMN balance_cents BIGINT NOT NULL DEFAULT 0;

UPDATE teams t
SET balance_cents = COALESCE(sub.total, 0)
FROM (SELECT team_id, SUM(balance_cents) AS total FROM team_members GROUP BY team_id) sub
WHERE sub.team_id = t.id;

ALTER TABLE team_members
    DROP COLUMN balance_cents;
