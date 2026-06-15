#[sqlx::test(migrations = "./migrations")]
#[ignore = "requires PostgreSQL for sqlx migration integration tests"]
async fn users_have_independent_venue_identity_flag(pool: sqlx::PgPool) {
    let row: (String, String, Option<String>) = sqlx::query_as(
        r#"
        SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rs_user_info'
          AND column_name = 'is_venue'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("rs_user_info.is_venue should exist");

    assert_eq!(row.0, "boolean");
    assert_eq!(row.1, "NO");
    assert_eq!(row.2.as_deref(), Some("false"));
}
