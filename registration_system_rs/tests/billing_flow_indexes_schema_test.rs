#[sqlx::test(migrations = "./migrations")]
async fn billing_flow_recent_indexes_exist_after_migrations(pool: sqlx::PgPool) {
    let expected_indexes = [
        "idx_recharge_records_user_created_at",
        "idx_user_billings_user_created_at",
        "idx_monthly_penalties_user_created_at",
        "idx_balance_adjustments_user_effective_created",
    ];

    for index_name in expected_indexes {
        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)::bigint
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = $1
            "#,
        )
        .bind(index_name)
        .fetch_one(&pool)
        .await
        .unwrap_or_else(|error| panic!("should query index {index_name}: {error}"));

        assert_eq!(count.0, 1, "{index_name} should exist");
    }
}
