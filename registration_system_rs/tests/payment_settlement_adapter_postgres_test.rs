use registration_system_backend::payment::adapters::PostgresPaymentSettlementAdapter;
use registration_system_backend::payment::ports::{
    PaymentSettlementPort, RechargePaymentSettlement,
};
use rust_decimal::Decimal;

#[sqlx::test(migrations = "./migrations")]
#[ignore = "requires PostgreSQL for sqlx migration integration tests"]
async fn settle_recharge_payment_is_idempotent(pool: sqlx::PgPool) {
    sqlx::query(
        r#"
        INSERT INTO rs_user_info (
            id, open_id, username, nickname, real_name, avatar_url, phone_number, is_manager, status, create_time, latest_login_date
        ) VALUES (
            900001, 'openid-payment-settlement-900001', '', '', '', '', '', 0, 1, NOW(), NOW()
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("user should insert");

    sqlx::query(
        r#"
        INSERT INTO rs_payment_orders (
            order_no, user_id, amount, payment_type, status, transaction_id, description, created_at, updated_at, paid_at
        ) VALUES (
            'order-settle-001', 900001, 12.50, 'recharge', 'paid', 'wx-settle-001', '账户充值', NOW(), NOW(), NOW()
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("payment order should insert");

    let adapter = PostgresPaymentSettlementAdapter::new(pool.clone());
    let settlement = RechargePaymentSettlement {
        order_no: "order-settle-001",
        user_id: 900001,
        amount: Decimal::new(1250, 2),
        transaction_id: "wx-settle-001",
        description: "微信充值",
    };

    adapter
        .settle_recharge_payment(settlement)
        .await
        .expect("first settlement should succeed");
    adapter
        .settle_recharge_payment(RechargePaymentSettlement {
            order_no: "order-settle-001",
            user_id: 900001,
            amount: Decimal::new(1250, 2),
            transaction_id: "wx-settle-001",
            description: "微信充值",
        })
        .await
        .expect("second settlement should be idempotent");

    let recharge_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM rs_recharge_records WHERE payment_order_no = 'order-settle-001'",
    )
    .fetch_one(&pool)
    .await
    .expect("recharge count should query");
    assert_eq!(recharge_count.0, 1);

    let account: (Decimal, Decimal) = sqlx::query_as(
        "SELECT balance, total_recharge FROM rs_user_accounts WHERE user_id = 900001",
    )
    .fetch_one(&pool)
    .await
    .expect("account should query");
    assert_eq!(account.0, Decimal::new(1250, 2));
    assert_eq!(account.1, Decimal::new(1250, 2));
}
