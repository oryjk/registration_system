#[test]
fn payment_order_list_uses_stable_newest_first_ordering() {
    let source = include_str!("../src/payment/adapters/persistence/postgres_payment_order_repository.rs");

    assert!(
        source.contains("ORDER BY created_at DESC, id DESC LIMIT $2"),
        "payment order list should sort newest first with id as a stable tie breaker"
    );
}

#[test]
fn admin_activity_list_uses_newest_match_time_first_ordering() {
    let source = include_str!("../src/activity/adapters/persistence/query.rs");

    assert!(
        source.contains("ORDER BY holding_date DESC, id DESC"),
        "admin activity list should sort newest match time first"
    );
}

#[test]
fn admin_activity_list_exposes_registration_preview() {
    let dto_source = include_str!("../src/activity/adapters/web/dto.rs");
    let query_source = include_str!("../src/activity/adapters/persistence/query.rs");

    assert!(
        dto_source.contains("pub registration_preview: ActivityRegistrationPreviewDto"),
        "activity list items should expose registration preview data"
    );
    assert!(
        query_source.contains("load_registration_previews"),
        "activity list query should load registration previews for current page items"
    );
}

#[test]
fn admin_activity_registration_preview_orders_visible_members_by_operation_time() {
    let source = include_str!("../src/activity/adapters/persistence/query.rs");

    assert!(
        source.contains("ORDER BY ua.operation_time ASC, ua.user_id ASC"),
        "visible registration preview members should follow mini-program order: earlier operation_time first"
    );
    assert!(
        source.contains("operation_time ASC,\n                     user_id ASC"),
        "registration preview result rows should keep operation_time ascending inside each visible status group"
    );
}
