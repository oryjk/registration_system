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
-- 实际充值语义：入账同时标记付费会员并刷新最近充值时间（微信到账与人工充值共用）。
UPDATE team_members
SET balance_cents = balance_cents + sqlc.arg('amount_cents'),
    is_paid_member = TRUE,
    last_recharge_at = GREATEST(last_recharge_at,
        COALESCE(sqlc.narg('received_on')::date::timestamp AT TIME ZONE 'Asia/Shanghai', NOW())),
    updated_at = NOW()
WHERE team_id = sqlc.arg('team_id') AND user_id = sqlc.arg('user_id')
RETURNING balance_cents;

-- name: AddTeamMemberFundBalance :one
-- 纯余额回加（冲正/结算重算回加）：不触发付费会员与最近充值时间语义。
UPDATE team_members
SET balance_cents = balance_cents + sqlc.arg('amount_cents'),
    updated_at = NOW()
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

-- name: ListTeamFundTransactionsForMember :many
-- 管理员/队长查看指定成员的队费流水（冲正需要定位原流水 ID）。
SELECT tr.*, m.name AS match_name, receipt.received_on
FROM team_fund_transactions tr
LEFT JOIN matches m ON m.id = tr.match_id
LEFT JOIN team_fund_credit_receipts receipt ON receipt.transaction_id = tr.id
WHERE tr.team_id = sqlc.arg('team_id')
  AND tr.user_id = sqlc.arg('user_id')
  AND (sqlc.arg('before_id')::bigint = 0 OR tr.id < sqlc.arg('before_id'))
ORDER BY tr.id DESC
LIMIT sqlc.arg('limit_rows');

-- name: GetManualReversalOriginalByKey :one
-- 冲正幂等复查：按键定位已落库的冲正流水及其关联的原流水（金额由原流水推导，不随请求携带）。
SELECT orig.id AS original_id, orig.team_id AS team_id,
       rev.id AS reversal_id, rev.balance_after_cents AS balance_after_cents
FROM team_fund_transactions rev
JOIN team_fund_transactions orig ON orig.reversed_by_transaction_id = rev.id
WHERE rev.source = 'manual_reversal'
  AND rev.source_id = sqlc.arg('source_id')
  AND rev.user_id = sqlc.arg('user_id');

-- name: ListTeamFundBalances :many
SELECT tm.team_id, t.name AS team_name, tm.balance_cents
FROM team_members tm
JOIN teams t ON t.id = tm.team_id
WHERE tm.user_id = sqlc.arg('user_id') AND tm.status = 'active'
ORDER BY tm.joined_at, tm.team_id;

-- name: ListTeamFundTransactionsForUser :many
SELECT tr.*, t.name AS team_name, m.name AS match_name, receipt.received_on
FROM team_fund_transactions tr
JOIN teams t ON t.id = tr.team_id
LEFT JOIN matches m ON m.id = tr.match_id
LEFT JOIN team_fund_credit_receipts receipt ON receipt.transaction_id = tr.id
WHERE tr.user_id = sqlc.arg('user_id')
  AND (sqlc.arg('before_id')::bigint = 0 OR tr.id < sqlc.arg('before_id'))
ORDER BY tr.id DESC
LIMIT sqlc.arg('limit_rows');

-- name: InsertAdminCreditFundTransaction :one
-- 管理员手动充值流水；source_id 为幂等键（未提供时为操作生成的 UUID）。
INSERT INTO team_fund_transactions
    (team_id, user_id, amount_cents, balance_after_cents, source, source_id, match_id, description,
     created_by_user_id, created_by_admin_id)
VALUES (sqlc.arg('team_id'), sqlc.arg('user_id'), sqlc.arg('amount_cents'),
        sqlc.arg('balance_after_cents'), 'admin_credit', sqlc.arg('source_id'), NULL,
        sqlc.arg('description'), sqlc.narg('created_by_user_id'), sqlc.narg('created_by_admin_id'))
RETURNING id;

-- name: InsertManualFundTransaction :one
-- 人工消费扣费 / 人工冲正流水；source_id 为幂等键。
INSERT INTO team_fund_transactions
    (team_id, user_id, amount_cents, balance_after_cents, source, source_id, match_id, description,
     created_by_user_id, created_by_admin_id)
VALUES (sqlc.arg('team_id'), sqlc.arg('user_id'), sqlc.arg('amount_cents'),
        sqlc.arg('balance_after_cents'), sqlc.arg('source'), sqlc.arg('source_id'), NULL,
        sqlc.arg('description'), sqlc.narg('created_by_user_id'), sqlc.narg('created_by_admin_id'))
RETURNING id;

-- name: GetTeamFundTransactionForUpdate :one
-- 冲正前锁定原流水行；reversed_by_transaction_id 非空表示已冲正。
SELECT id, team_id, user_id, amount_cents, source, reversed_by_transaction_id
FROM team_fund_transactions
WHERE id = sqlc.arg('id')
FOR UPDATE;

-- name: MarkTeamFundTransactionReversed :exec
UPDATE team_fund_transactions
SET reversed_by_transaction_id = sqlc.arg('reversal_id')
WHERE id = sqlc.arg('id');

-- name: InsertTeamFundCreditReceipt :exec
INSERT INTO team_fund_credit_receipts (transaction_id, received_on)
VALUES (sqlc.arg('transaction_id'), sqlc.arg('received_on'));

-- name: GetTeamFundCreditReceiptDate :one
SELECT received_on FROM team_fund_credit_receipts WHERE transaction_id = sqlc.arg('transaction_id');
