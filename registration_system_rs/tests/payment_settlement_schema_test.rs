#[sqlx::test(migrations = "./migrations")]
async fn recharge_records_has_payment_order_foreign_key_and_unique_index(pool: sqlx::PgPool) {
    let fk_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'rs_recharge_records'
          AND kcu.column_name = 'payment_order_no'
          AND ccu.table_name = 'rs_payment_orders'
          AND ccu.column_name = 'order_no'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query recharge record payment order foreign key");
    assert_eq!(fk_count.0, 1);

    let unique_index_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'rs_recharge_records'
          AND indexname = 'uk_recharge_records_payment_order_no'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query recharge record payment order unique index");
    assert_eq!(unique_index_count.0, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn team_membership_orders_has_unique_transaction_id_index(pool: sqlx::PgPool) {
    let unique_index_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'rs_team_membership_orders'
          AND indexname = 'uk_team_membership_orders_transaction_id'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query membership order transaction unique index");
    assert_eq!(unique_index_count.0, 1);
}
