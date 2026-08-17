-- name: CreatePaymentOrder :one
INSERT INTO payment_orders (
    order_no, user_id, amount_cents, provider, channel, status, kind, team_id, months, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
RETURNING *;

-- name: ApplyTeamMembershipToTeam :one
UPDATE teams
SET credit_score = LEAST(100, credit_score + sqlc.arg('credit_delta')::int),
    vip_until = GREATEST(NOW(), COALESCE(vip_until, NOW())) + (sqlc.arg('months')::int * INTERVAL '30 days'),
    updated_at = NOW()
WHERE id = sqlc.arg('team_id')::bigint
RETURNING credit_score, vip_until;

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
