#[sqlx::test(migrations = "./migrations")]
#[ignore = "requires PostgreSQL for sqlx migration integration tests"]
async fn activity_fee_snapshot_table_replaces_activity_order(pool: sqlx::PgPool) {
    let new_table_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'rs_activity_fee_snapshots'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query rs_activity_fee_snapshots");

    let old_table_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'rs_activity_order'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query rs_activity_order");

    assert_eq!(new_table_count.0, 1);
    assert_eq!(old_table_count.0, 0);
}

#[sqlx::test(migrations = "./migrations")]
#[ignore = "requires PostgreSQL for sqlx migration integration tests"]
async fn activity_fee_snapshot_activity_id_keeps_activity_foreign_key(pool: sqlx::PgPool) {
    let count: (i64,) = sqlx::query_as(
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
          AND tc.table_name = 'rs_activity_fee_snapshots'
          AND kcu.column_name = 'activity_id'
          AND ccu.table_name = 'rs_activity'
          AND ccu.column_name = 'id'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query rs_activity_fee_snapshots.activity_id foreign key");

    assert_eq!(count.0, 1);
}
