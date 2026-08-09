-- name: GetWalletAccount :one
SELECT * FROM wallet_accounts WHERE user_id = $1;

-- name: ListWalletTransactions :many
SELECT * FROM wallet_transactions
WHERE user_id = $1
ORDER BY created_at DESC, id DESC
LIMIT $2 OFFSET $3;

-- name: CountWalletTransactions :one
SELECT COUNT(*) FROM wallet_transactions WHERE user_id = $1;

-- name: EnsureDebitWalletAccount :one
INSERT INTO wallet_accounts (user_id)
VALUES ($1)
ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
RETURNING *;

-- name: GetDebitWalletAccountForUpdate :one
SELECT * FROM wallet_accounts WHERE user_id = $1 FOR UPDATE;

-- name: GetWalletTransactionBySource :one
SELECT * FROM wallet_transactions WHERE source_type = $1 AND source_id = $2;

-- name: DebitWalletAccount :one
UPDATE wallet_accounts
SET balance_cents = balance_cents - $2,
    total_spent_cents = total_spent_cents + $2,
    version = version + 1,
    updated_at = NOW()
WHERE user_id = $1 AND balance_cents >= $2
RETURNING *;

-- name: InsertDebitWalletTransaction :one
INSERT INTO wallet_transactions (
    id, user_id, direction, type, amount_cents, balance_after_cents,
    source_type, source_id, description
) VALUES ($1, $2, 'debit', 'spend', $3, $4, $5, $6, $7)
RETURNING *;
