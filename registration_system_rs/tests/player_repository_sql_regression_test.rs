#[test]
fn player_repository_joins_numeric_team_ids_without_text_casts() {
    let source = include_str!("../src/user/adapters/persistence/postgres_user_repository.rs");

    assert!(
        !source.contains("tm.team_id::text"),
        "player list queries must not compare bigint team ids to text"
    );
    assert!(
        !source.contains("CAST(t.id AS TEXT)"),
        "player team summaries should keep team_id numeric"
    );
    assert!(
        source.matches("JOIN rs_teams t ON t.id = tm.team_id").count() >= 3,
        "player list count, player list page, and team summary queries should all join bigint team ids directly"
    );
}
