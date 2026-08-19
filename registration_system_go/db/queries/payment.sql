-- name: CreatePaymentOrder :one
INSERT INTO payment_orders (
    order_no, user_id, amount_cents, provider, channel, status, kind, team_id, match_id, months, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
RETURNING *;

-- name: CreditTeamMemberFundBalance :one
UPDATE team_members
SET balance_cents = balance_cents + sqlc.arg('amount_cents')::bigint,
    updated_at = NOW()
WHERE team_id = sqlc.arg('team_id')::bigint
  AND user_id = sqlc.arg('user_id')::bigint
RETURNING balance_cents;

-- name: MarkMatchRegistrationPaid :execrows
-- 报名费订单核销后标记报名已支付；幂等，重复核销无副作用。
UPDATE match_registrations r
SET paid = TRUE, updated_at = NOW()
FROM match_registration_groups g
WHERE r.group_id = g.id
  AND g.match_id = sqlc.arg('match_id')::uuid
  AND r.user_id = sqlc.arg('user_id')::bigint
  AND r.status <> 'cancelled';

-- name: GetPaymentOrder :one
SELECT * FROM payment_orders WHERE order_no = $1;

-- name: GetPaymentOrderForUpdate :one
SELECT * FROM payment_orders WHERE order_no = $1 FOR UPDATE;

-- name: SavePaymentOrderPrepared :one
UPDATE payment_orders
SET prepay_id = $2, updated_at = $3
WHERE order_no = $1 AND status = 'pending' AND (prepay_id IS NULL OR prepay_id = $2)
RETURNING *;

-- name: MarkPaymentOrderFailed :execrows
UPDATE payment_orders
SET status = 'failed', updated_at = $2
WHERE order_no = $1 AND status = 'pending';

-- name: CancelPaymentOrder :one
UPDATE payment_orders
SET status = 'cancelled', cancelled_at = $2, updated_at = $2
WHERE order_no = $1 AND status = 'pending'
RETURNING *;

-- name: ListPaymentOrders :many
SELECT * FROM payment_orders
WHERE (sqlc.arg(user_id)::bigint = 0 OR user_id = sqlc.arg(user_id))
  AND (sqlc.arg(status)::text = '' OR status = sqlc.arg(status))
  AND (sqlc.arg(search)::text = '' OR order_no ILIKE '%' || sqlc.arg(search) || '%')
ORDER BY created_at DESC, order_no DESC
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: CountPaymentOrders :one
SELECT COUNT(*) FROM payment_orders
WHERE (sqlc.arg(user_id)::bigint = 0 OR user_id = sqlc.arg(user_id))
  AND (sqlc.arg(status)::text = '' OR status = sqlc.arg(status))
  AND (sqlc.arg(search)::text = '' OR order_no ILIKE '%' || sqlc.arg(search) || '%');

-- name: GetPaymentUserOpenID :one
SELECT openid FROM users WHERE id = $1 AND status = 'active';

-- name: MarkPaymentOrderPaid :one
UPDATE payment_orders
SET status = 'paid', transaction_id = $2, paid_at = $3, updated_at = $3
WHERE order_no = $1 AND status = 'pending'
RETURNING *;

-- name: EnsureRechargeWalletAccount :one
INSERT INTO wallet_accounts (user_id)
VALUES ($1)
ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
RETURNING *;

-- name: GetRechargeWalletAccountForUpdate :one
SELECT * FROM wallet_accounts WHERE user_id = $1 FOR UPDATE;

-- name: GetRechargeWalletTransactionBySource :one
SELECT * FROM wallet_transactions
WHERE source_type = 'payment_order' AND source_id = $1;

-- name: InsertRechargeWalletTransaction :one
INSERT INTO wallet_transactions (
    id, user_id, direction, type, amount_cents, balance_after_cents,
    source_type, source_id, description
) VALUES ($1, $2, 'credit', 'recharge', $3, $4, 'payment_order', $5, $6)
ON CONFLICT (source_type, source_id) DO NOTHING
RETURNING *;

-- name: CreditRechargeWallet :one
UPDATE wallet_accounts
SET balance_cents = balance_cents + $2,
    total_recharged_cents = total_recharged_cents + $2,
    version = version + 1,
    updated_at = NOW()
WHERE user_id = $1
RETURNING *;

-- name: CancelPendingMatchRegistrationOrders :execrows
-- 改人数后重新下单前关闭同比赛同人的遗留未付订单，避免旧金额订单被误付。
UPDATE payment_orders
SET status = 'cancelled', cancelled_at = $3, updated_at = $3
WHERE match_id = $1 AND user_id = $2 AND kind = 'match_registration' AND status = 'pending';

-- name: GetPaymentUserNickname :one
-- 打赏下单时的昵称快照来源；只认 active 用户，与 openid 读取同一约束。
SELECT nickname FROM users WHERE id = $1 AND status = 'active';

-- name: CreateTip :one
INSERT INTO tips (order_no, user_id, nickname, amount_cents, suggestion, status, created_at)
VALUES ($1, $2, $3, $4, $5, 'pending', $6)
RETURNING *;

-- name: MarkTipSubmitted :execrows
-- 打赏订单核销后置建议为已生效；幂等，重复核销无副作用。
UPDATE tips
SET status = 'submitted', submitted_at = $2
WHERE order_no = $1 AND status = 'pending';

-- name: ListSubmittedTips :many
SELECT * FROM tips
WHERE status = 'submitted'
ORDER BY submitted_at DESC, id DESC
LIMIT sqlc.arg(result_limit) OFFSET sqlc.arg(result_offset);

-- name: CountSubmittedTips :one
SELECT COUNT(*) FROM tips WHERE status = 'submitted';
