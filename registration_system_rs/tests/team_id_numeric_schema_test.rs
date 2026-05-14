#[sqlx::test(migrations = "./migrations")]
async fn team_id_columns_are_bigint_after_migrations(pool: sqlx::PgPool) {
    let expected_columns = [
        ("rs_teams", "id"),
        ("rs_team_members", "team_id"),
        ("rs_activity", "home_team_id"),
        ("rs_activity", "away_team_id"),
        ("rs_activity_team_checkin_configs", "team_id"),
        ("rs_activity_checkins", "team_id"),
        ("rs_challenges", "host_team_id"),
        ("rs_challenges", "guest_team_id"),
        ("rs_team_credit_transactions", "team_id"),
        ("rs_team_credit_transactions", "reviewer_team_id"),
        ("rs_activity_team_reviews", "reviewer_team_id"),
        ("rs_activity_team_reviews", "reviewee_team_id"),
        ("rs_team_membership_orders", "team_id"),
        ("rs_admin_team_assignment", "team_id"),
    ];

    for (table_name, column_name) in expected_columns {
        let row: (String,) = sqlx::query_as(
            r#"
            SELECT data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
              AND column_name = $2
            "#,
        )
        .bind(table_name)
        .bind(column_name)
        .fetch_one(&pool)
        .await
        .unwrap_or_else(|error| panic!("{table_name}.{column_name} should exist: {error}"));

        assert_eq!(
            row.0, "bigint",
            "{table_name}.{column_name} should be bigint"
        );
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn billing_activity_id_has_activity_foreign_key_after_migrations(pool: sqlx::PgPool) {
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
          AND tc.table_name = 'rs_user_billings'
          AND kcu.column_name = 'activity_id'
          AND ccu.table_name = 'rs_activity'
          AND ccu.column_name = 'id'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query rs_user_billings.activity_id foreign key");

    assert_eq!(count.0, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn billing_activity_terms_are_applied_after_migrations(pool: sqlx::PgPool) {
    let billing_default: (Option<String>,) = sqlx::query_as(
        r#"
        SELECT column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rs_user_billings'
          AND column_name = 'billing_type'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query rs_user_billings.billing_type default");

    let billing_default = billing_default
        .0
        .expect("rs_user_billings.billing_type should have default");
    assert!(
        billing_default.contains("activity_fee"),
        "rs_user_billings.billing_type default should be activity_fee, got {billing_default}"
    );

    let activity_fee_column_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rs_user_monthly_balance'
          AND column_name = 'activity_fee_amount'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query rs_user_monthly_balance.activity_fee_amount");
    assert_eq!(activity_fee_column_count.0, 1);

    let game_fee_column_count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rs_user_monthly_balance'
          AND column_name = 'game_fee_amount'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("should query rs_user_monthly_balance.game_fee_amount");
    assert_eq!(game_fee_column_count.0, 0);
}
