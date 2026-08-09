-- +goose Up
CREATE TABLE payment_orders (
    order_no VARCHAR(32) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    amount_cents BIGINT NOT NULL,
    provider VARCHAR(16) NOT NULL DEFAULT 'wechat',
    channel VARCHAR(32) NOT NULL DEFAULT 'mini_program_jsapi',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    prepay_id VARCHAR(128) NULL,
    transaction_id VARCHAR(64) NULL,
    paid_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payment_orders_order_no_not_blank CHECK (BTRIM(order_no) <> ''),
    CONSTRAINT payment_orders_amount_positive CHECK (amount_cents > 0),
    CONSTRAINT payment_orders_provider_check CHECK (provider = 'wechat'),
    CONSTRAINT payment_orders_channel_check CHECK (channel = 'mini_program_jsapi'),
    CONSTRAINT payment_orders_status_check CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
    CONSTRAINT payment_orders_state_fields_check CHECK (
        (status = 'paid' AND transaction_id IS NOT NULL AND paid_at IS NOT NULL AND cancelled_at IS NULL)
        OR (status = 'cancelled' AND transaction_id IS NULL AND paid_at IS NULL AND cancelled_at IS NOT NULL)
        OR (status IN ('pending', 'failed') AND transaction_id IS NULL AND paid_at IS NULL AND cancelled_at IS NULL)
    )
);

CREATE UNIQUE INDEX payment_orders_transaction_unique
    ON payment_orders (transaction_id)
    WHERE transaction_id IS NOT NULL;
CREATE INDEX payment_orders_user_created_idx ON payment_orders (user_id, created_at DESC, order_no DESC);
CREATE INDEX payment_orders_status_created_idx ON payment_orders (status, created_at DESC, order_no DESC);

CREATE TABLE wallet_accounts (
    user_id BIGINT PRIMARY KEY REFERENCES users(id),
    balance_cents BIGINT NOT NULL DEFAULT 0,
    total_recharged_cents BIGINT NOT NULL DEFAULT 0,
    total_spent_cents BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wallet_accounts_balance_nonnegative CHECK (balance_cents >= 0),
    CONSTRAINT wallet_accounts_totals_nonnegative CHECK (total_recharged_cents >= 0 AND total_spent_cents >= 0),
    CONSTRAINT wallet_accounts_version_nonnegative CHECK (version >= 0)
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    direction VARCHAR(8) NOT NULL,
    type VARCHAR(16) NOT NULL,
    amount_cents BIGINT NOT NULL,
    balance_after_cents BIGINT NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_id VARCHAR(128) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wallet_transactions_direction_check CHECK (direction IN ('credit', 'debit')),
    CONSTRAINT wallet_transactions_type_check CHECK (type IN ('recharge', 'spend')),
    CONSTRAINT wallet_transactions_shape_check CHECK (
        (direction = 'credit' AND type = 'recharge')
        OR (direction = 'debit' AND type = 'spend')
    ),
    CONSTRAINT wallet_transactions_amount_positive CHECK (amount_cents > 0),
    CONSTRAINT wallet_transactions_balance_nonnegative CHECK (balance_after_cents >= 0),
    CONSTRAINT wallet_transactions_source_not_blank CHECK (BTRIM(source_type) <> '' AND BTRIM(source_id) <> ''),
    CONSTRAINT wallet_transactions_source_unique UNIQUE (source_type, source_id)
);

CREATE INDEX wallet_transactions_user_created_idx ON wallet_transactions (user_id, created_at DESC, id DESC);

-- +goose Down
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS wallet_accounts;
DROP TABLE IF EXISTS payment_orders;

