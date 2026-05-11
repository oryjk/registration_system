use registration_system_backend::bootstrap::migrations::MIGRATOR;

#[test]
fn baseline_migration_exists() {
    let first = MIGRATOR
        .iter()
        .next()
        .expect("必须至少存在一个基线 migration");

    assert_eq!(first.description, "baseline");
}
