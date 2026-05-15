#[sqlx::test(migrations = "./migrations")]
async fn team_members_has_is_member_flag(pool: sqlx::PgPool) {
    let row: (String, String, Option<String>) = sqlx::query_as(
        r#"
        SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rs_team_members'
          AND column_name = 'is_member'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("rs_team_members.is_member should exist");

    assert_eq!(row.0, "boolean");
    assert_eq!(row.1, "NO");
    assert_eq!(row.2.as_deref(), Some("false"));
}
