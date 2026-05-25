#[sqlx::test(migrations = "./migrations")]
async fn challenges_have_payment_mode_column(pool: sqlx::PgPool) {
    let row: (String, String, Option<String>) = sqlx::query_as(
        r#"
        SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rs_challenges'
          AND column_name = 'payment_mode'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("rs_challenges.payment_mode should exist");

    assert_eq!(row.0, "character varying");
    assert_eq!(row.1, "NO");
    assert_eq!(row.2.as_deref(), Some("'postpaid'::character varying"));
}

#[sqlx::test(migrations = "./migrations")]
async fn individual_acceptances_have_payment_tracking_columns(pool: sqlx::PgPool) {
    let columns = sqlx::query_as::<_, (String, String, String)>(
        r#"
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rs_challenge_individual_acceptances'
          AND column_name IN (
              'payment_status',
              'payment_deadline_at',
              'payment_order_no',
              'payment_notified_at'
          )
        ORDER BY column_name
        "#,
    )
    .fetch_all(&pool)
    .await
    .expect("should query individual acceptance payment columns");

    assert_eq!(
        columns,
        vec![
            (
                "payment_deadline_at".to_string(),
                "timestamp without time zone".to_string(),
                "YES".to_string()
            ),
            (
                "payment_notified_at".to_string(),
                "timestamp without time zone".to_string(),
                "YES".to_string()
            ),
            (
                "payment_order_no".to_string(),
                "character varying".to_string(),
                "YES".to_string()
            ),
            (
                "payment_status".to_string(),
                "character varying".to_string(),
                "NO".to_string()
            ),
        ]
    );
}
