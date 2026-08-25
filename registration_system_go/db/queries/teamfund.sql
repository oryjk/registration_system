-- name: EnsureTeamMemberFundRow :execrows
-- 结算扣款前确保成员行存在（余额 0 起扣，允许扣成负数即欠款）。
INSERT INTO team_members (team_id, user_id)
VALUES (sqlc.arg('team_id'), sqlc.arg('user_id'))
ON CONFLICT (team_id, user_id) DO NOTHING;

-- name: LockTeamMemberFund :one
SELECT id FROM team_members
WHERE team_id = sqlc.arg('team_id') AND user_id = sqlc.arg('user_id')
FOR UPDATE;

-- name: GetActiveTeamMemberForCredit :one
-- 管理员充值前校验目标是 status='active' 的正式成员并锁定该行；FOR UPDATE 顶替 LockTeamMemberFund 的锁语义。
SELECT id FROM team_members
WHERE team_id = sqlc.arg('team_id') AND user_id = sqlc.arg('user_id')
  AND status = 'active'
FOR UPDATE;

-- name: DebitTeamMemberFund :one
UPDATE team_members
SET balance_cents = balance_cents - sqlc.arg('amount_cents'), updated_at = NOW()
WHERE team_id = sqlc.arg('team_id') AND user_id = sqlc.arg('user_id')
RETURNING balance_cents;

-- name: CreditTeamMemberFund :one
UPDATE team_members
SET balance_cents = balance_cents + sqlc.arg('amount_cents'), updated_at = NOW()
WHERE team_id = sqlc.arg('team_id') AND user_id = sqlc.arg('user_id')
RETURNING balance_cents;

-- name: GetTeamMemberFundBalance :one
SELECT balance_cents FROM team_members
WHERE team_id = sqlc.arg('team_id') AND user_id = sqlc.arg('user_id');

-- name: GetActiveSettlementBatchForUpdate :one
SELECT * FROM match_settlement_batches
WHERE match_id = sqlc.arg('match_id')
  AND operation_type = 'settle' AND reversed_by_batch_id IS NULL
FOR UPDATE;

-- name: GetNextSettlementBatchNo :one
SELECT COALESCE(MAX(batch_no), 0) + 1 FROM match_settlement_batches WHERE match_id = sqlc.arg('match_id');

-- name: InsertSettlementBatch :one
INSERT INTO match_settlement_batches
    (match_id, batch_no, operation_type, reversal_of_batch_id, reversed_by_batch_id,
     description, total_amount_cents, user_count, created_by_user_id)
VALUES (sqlc.arg('match_id'), sqlc.arg('batch_no'), sqlc.arg('operation_type'),
        sqlc.narg('reversal_of_batch_id'), sqlc.narg('reversed_by_batch_id'),
        sqlc.arg('description'), sqlc.arg('total_amount_cents'), sqlc.arg('user_count'),
        sqlc.arg('created_by_user_id'))
RETURNING id;

-- name: MarkSettlementBatchReversed :exec
UPDATE match_settlement_batches SET reversed_by_batch_id = sqlc.arg('reversed_by_batch_id')
WHERE id = sqlc.arg('batch_id');

-- name: ListTeamFundTransactionsBySource :many
SELECT * FROM team_fund_transactions
WHERE source = sqlc.arg('source') AND source_id = sqlc.arg('source_id')
ORDER BY id;

-- name: InsertTeamFundTransaction :execrows
INSERT INTO team_fund_transactions
    (team_id, user_id, amount_cents, balance_after_cents, source, source_id, match_id, description)
VALUES (sqlc.arg('team_id'), sqlc.arg('user_id'), sqlc.arg('amount_cents'), sqlc.arg('balance_after_cents'),
        sqlc.arg('source'), sqlc.arg('source_id'), sqlc.narg('match_id'), sqlc.arg('description'));

-- name: ListSettlementBatches :many
SELECT * FROM match_settlement_batches WHERE match_id = sqlc.arg('match_id') ORDER BY batch_no DESC;

-- name: ListTeamFundBalances :many
SELECT tm.team_id, t.name AS team_name, tm.balance_cents
FROM team_members tm
JOIN teams t ON t.id = tm.team_id
WHERE tm.user_id = sqlc.arg('user_id') AND tm.status = 'active'
ORDER BY tm.joined_at, tm.team_id;

-- name: ListTeamFundTransactionsForUser :many
SELECT tr.*, t.name AS team_name, m.name AS match_name
FROM team_fund_transactions tr
JOIN teams t ON t.id = tr.team_id
LEFT JOIN matches m ON m.id = tr.match_id
WHERE tr.user_id = sqlc.arg('user_id')
  AND (sqlc.arg('before_id')::bigint = 0 OR tr.id < sqlc.arg('before_id'))
ORDER BY tr.id DESC
LIMIT sqlc.arg('limit_rows');

-- name: InsertAdminCreditFundTransaction :one
-- 管理员手动充值流水；source_id 为本次操作生成的 UUID 字符串。
INSERT INTO team_fund_transactions
    (team_id, user_id, amount_cents, balance_after_cents, source, source_id, match_id, description)
VALUES (sqlc.arg('team_id'), sqlc.arg('user_id'), sqlc.arg('amount_cents'),
        sqlc.arg('balance_after_cents'), 'admin_credit', sqlc.arg('source_id'), NULL, sqlc.arg('description'))
RETURNING id;
