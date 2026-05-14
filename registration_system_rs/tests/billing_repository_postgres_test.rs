use chrono::{Duration, Local};
use registration_system_backend::billing::adapters::PostgresBillingRepository;
use registration_system_backend::billing::domain::{SettlementMode, SettlementParticipantScope};
use registration_system_backend::billing::ports::{
    BillingCommandRepository, SettlementCharge, SettlementRequest,
};
use rust_decimal::Decimal;
use sqlx::PgPool;
use std::sync::OnceLock;
use tokio::sync::Mutex;
use uuid::Uuid;

async fn billing_test_guard() -> tokio::sync::MutexGuard<'static, ()> {
    static GUARD: OnceLock<Mutex<()>> = OnceLock::new();
    GUARD.get_or_init(|| Mutex::new(())).lock().await
}

fn test_database_url() -> Option<String> {
    let _ = dotenvy::from_filename(".env");
    std::env::var("DATABASE_URL").ok()
}

#[derive(Debug, Clone)]
struct UserAccountSnapshot {
    user_id: i64,
    balance: Decimal,
    total_expense: Decimal,
}

async fn load_user_account_snapshots(pool: &PgPool, user_ids: &[i64]) -> Vec<UserAccountSnapshot> {
    let mut snapshots = Vec::with_capacity(user_ids.len());
    for user_id in user_ids {
        let row = sqlx::query_as::<_, (Decimal, Decimal)>(
            "SELECT balance, total_expense FROM rs_user_accounts WHERE user_id = $1",
        )
        .bind(*user_id)
        .fetch_optional(pool)
        .await
        .expect("account snapshot should query");

        let (balance, total_expense) = row.unwrap_or((Decimal::ZERO, Decimal::ZERO));
        snapshots.push(UserAccountSnapshot {
            user_id: *user_id,
            balance,
            total_expense,
        });
    }
    snapshots
}

async fn restore_user_account_snapshots(pool: &PgPool, snapshots: &[UserAccountSnapshot]) {
    for snapshot in snapshots {
        sqlx::query(
            r#"
            INSERT INTO rs_user_accounts (
                user_id, balance, total_recharge, total_expense, total_penalty, version, status, created_at, updated_at
            )
            VALUES ($1, $2, 0, $3, 0, 1, 1, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                balance = EXCLUDED.balance,
                total_expense = EXCLUDED.total_expense,
                last_updated = NOW(),
                updated_at = NOW()
            "#,
        )
        .bind(snapshot.user_id)
        .bind(snapshot.balance)
        .bind(snapshot.total_expense)
        .execute(pool)
        .await
        .expect("account snapshot should restore");
    }
}

async fn cleanup_activity(pool: &PgPool, activity_id: &str) {
    sqlx::query("DELETE FROM rs_user_billings WHERE activity_id = $1")
        .bind(activity_id)
        .execute(pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_activity_settlement_batches WHERE activity_id = $1")
        .bind(activity_id)
        .execute(pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_activity_fee_snapshots WHERE activity_id = $1")
        .bind(activity_id)
        .execute(pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_user_activity WHERE activity_id = $1")
        .bind(activity_id)
        .execute(pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_activity WHERE id = $1")
        .bind(activity_id)
        .execute(pool)
        .await
        .ok();
}

async fn create_finished_activity_with_registrations(
    pool: &PgPool,
    activity_id: &str,
    attending_user_ids: &[i64],
    leave_user_ids: &[i64],
) {
    let now = Local::now().naive_local();
    sqlx::query(
        r#"
        INSERT INTO rs_activity (
            id, start_time, end_time, holding_date, location, name, status, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, '结算策略球场', '结算策略活动', 2, NOW(), NOW()
        )
        "#,
    )
    .bind(activity_id)
    .bind(now - Duration::hours(2))
    .bind(now - Duration::hours(1))
    .bind(now - Duration::hours(2))
    .execute(pool)
    .await
    .expect("activity should insert");

    for user_id in attending_user_ids {
        sqlx::query(
            r#"
            INSERT INTO rs_user_activity (
                activity_id, user_id, stand, registration_count, paid, operation_time, created_at, updated_at
            ) VALUES ($1, $2, 1, 1, 0, NOW(), NOW(), NOW())
            "#,
        )
        .bind(activity_id)
        .bind(user_id)
        .execute(pool)
        .await
        .expect("attending registration should insert");
    }

    for user_id in leave_user_ids {
        sqlx::query(
            r#"
            INSERT INTO rs_user_activity (
                activity_id, user_id, stand, registration_count, paid, operation_time, created_at, updated_at
            ) VALUES ($1, $2, 2, 0, 0, NOW(), NOW(), NOW())
            "#,
        )
        .bind(activity_id)
        .bind(user_id)
        .execute(pool)
        .await
        .expect("leave registration should insert");
    }
}

#[tokio::test]
async fn settle_activity_expense_bills_attending_users_once() {
    let _guard = billing_test_guard().await;
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    let repo = PostgresBillingRepository::new(pool.clone());
    let activity_id = Uuid::new_v4().to_string();
    let now = Local::now().naive_local();
    let original_accounts = load_user_account_snapshots(&pool, &[4, 18]).await;

    sqlx::query(
        r#"
        INSERT INTO rs_activity (
            id, start_time, end_time, holding_date, location, name, status, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, '结算验收球场', '结算验收活动', 2, NOW(), NOW()
        )
        "#,
    )
    .bind(&activity_id)
    .bind(now - Duration::hours(2))
    .bind(now - Duration::hours(1))
    .bind(now - Duration::hours(2))
    .execute(&pool)
    .await
    .expect("activity should insert");

    sqlx::query(
        r#"
        INSERT INTO rs_user_activity (
            activity_id, user_id, stand, registration_count, paid, operation_time, created_at, updated_at
        ) VALUES
            ($1, 4, 1, 1, 0, NOW(), NOW(), NOW()),
            ($1, 18, 1, 1, 0, NOW(), NOW(), NOW()),
            ($1, 2, 2, 0, 0, NOW(), NOW(), NOW())
        "#,
    )
    .bind(&activity_id)
    .execute(&pool)
    .await
    .expect("registrations should insert");

    let summary = repo
        .settle_activity_expense(
            &activity_id,
            Decimal::new(4800, 2),
            Some("赛后 AA 扣费"),
            Some(1),
        )
        .await
        .expect("settlement should succeed");

    let billing_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM rs_user_billings WHERE activity_id = $1 AND billing_type = 'activity_fee'",
    )
    .bind(&activity_id)
    .fetch_one(&pool)
    .await
    .expect("billing count should query");

    restore_user_account_snapshots(&pool, &original_accounts).await;
    cleanup_activity(&pool, &activity_id).await;

    assert!(summary.settled);
    assert_eq!(summary.attending_user_count, 2);
    assert_eq!(summary.settled_user_count, 2);
    assert_eq!(summary.aa_fee, Some(Decimal::new(2400, 2)));
    assert_eq!(summary.total_amount, Some(Decimal::new(4800, 2)));
    assert_eq!(summary.current_batch_no, Some(1));
    assert_eq!(summary.history.len(), 1);
    assert_eq!(summary.items.len(), 2);
    assert_eq!(summary.items[0].user_id, 4);
    assert_eq!(summary.items[0].fee, Some(Decimal::new(2400, 2)));
    assert!(summary.items[0].billed);
    assert_eq!(summary.items[1].user_id, 18);
    assert_eq!(summary.items[1].fee, Some(Decimal::new(2400, 2)));
    assert!(summary.items[1].billed);
    assert_eq!(billing_count, 2);
}

#[tokio::test]
async fn settle_activity_expense_can_resettle_by_reversing_previous_batch() {
    let _guard = billing_test_guard().await;
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    let repo = PostgresBillingRepository::new(pool.clone());
    let activity_id = Uuid::new_v4().to_string();
    let now = Local::now().naive_local();
    let original_accounts = load_user_account_snapshots(&pool, &[4, 18]).await;

    sqlx::query(
        r#"
        INSERT INTO rs_activity (
            id, start_time, end_time, holding_date, location, name, status, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, '重结算验收球场', '重结算验收活动', 2, NOW(), NOW()
        )
        "#,
    )
    .bind(&activity_id)
    .bind(now - Duration::hours(2))
    .bind(now - Duration::hours(1))
    .bind(now - Duration::hours(2))
    .execute(&pool)
    .await
    .expect("activity should insert");

    sqlx::query(
        r#"
        INSERT INTO rs_user_activity (
            activity_id, user_id, stand, registration_count, paid, operation_time, created_at, updated_at
        ) VALUES
            ($1, 4, 1, 1, 0, NOW(), NOW(), NOW()),
            ($1, 18, 1, 1, 0, NOW(), NOW(), NOW())
        "#,
    )
    .bind(&activity_id)
    .execute(&pool)
    .await
    .expect("registrations should insert");

    repo.settle_activity_expense(
        &activity_id,
        Decimal::new(4800, 2),
        Some("第一次结算"),
        Some(1),
    )
    .await
    .expect("first settlement should succeed");

    let summary = repo
        .settle_activity_expense(
            &activity_id,
            Decimal::new(6000, 2),
            Some("修改后重结算"),
            Some(1),
        )
        .await
        .expect("resettlement should succeed");

    let billings = sqlx::query_as::<_, (i64, Decimal, String, Option<i64>)>(
        r#"
        SELECT user_id, fee, billing_type, settlement_batch_id
        FROM rs_user_billings
        WHERE activity_id = $1
        ORDER BY id ASC
        "#,
    )
    .bind(&activity_id)
    .fetch_all(&pool)
    .await
    .expect("billings should query");

    let batch_rows = sqlx::query_as::<_, (i32, String, Option<i64>, Decimal, i32)>(
        r#"
        SELECT batch_no, operation_type, reversal_of_batch_id, total_amount, user_count
        FROM rs_activity_settlement_batches
        WHERE activity_id = $1
        ORDER BY batch_no ASC
        "#,
    )
    .bind(&activity_id)
    .fetch_all(&pool)
    .await
    .expect("batch rows should query");

    let after_accounts = load_user_account_snapshots(&pool, &[4, 18]).await;

    restore_user_account_snapshots(&pool, &original_accounts).await;
    cleanup_activity(&pool, &activity_id).await;

    assert!(summary.settled);
    assert_eq!(summary.total_amount, Some(Decimal::new(6000, 2)));
    assert_eq!(summary.aa_fee, Some(Decimal::new(3000, 2)));
    assert_eq!(summary.current_batch_no, Some(3));
    assert_eq!(summary.history.len(), 3);

    assert_eq!(billings.len(), 6);
    assert_eq!(billings[0].1, Decimal::new(2400, 2));
    assert_eq!(billings[2].1, Decimal::new(-2400, 2));
    assert_eq!(billings[4].1, Decimal::new(3000, 2));
    assert!(billings.iter().all(|item| item.3.is_some()));

    assert_eq!(
        batch_rows[0],
        (1, "settle".to_string(), None, Decimal::new(4800, 2), 2)
    );
    assert_eq!(batch_rows[1].0, 2);
    assert_eq!(batch_rows[1].1, "reverse".to_string());
    assert!(batch_rows[1].2.is_some());
    assert_eq!(
        batch_rows[2],
        (3, "settle".to_string(), None, Decimal::new(6000, 2), 2)
    );

    for (before, after) in original_accounts.iter().zip(after_accounts.iter()) {
        assert_eq!(after.balance, before.balance - Decimal::new(3000, 2));
        assert_eq!(
            after.total_expense,
            before.total_expense + Decimal::new(3000, 2)
        );
    }
}

#[tokio::test]
async fn settle_activity_expense_supports_custom_user_aa_without_creating_registrations() {
    let _guard = billing_test_guard().await;
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    let repo = PostgresBillingRepository::new(pool.clone());
    let activity_id = Uuid::new_v4().to_string();
    let original_accounts = load_user_account_snapshots(&pool, &[4, 18, 2]).await;

    create_finished_activity_with_registrations(&pool, &activity_id, &[4, 18], &[]).await;

    let summary = repo
        .settle_activity_expense_with_charges(SettlementRequest {
            activity_id: &activity_id,
            mode: SettlementMode::Aa,
            participant_scope: SettlementParticipantScope::CustomUsers,
            total_amount: Decimal::new(9000, 2),
            charges: &[
                SettlementCharge {
                    user_id: 4,
                    amount: None,
                },
                SettlementCharge {
                    user_id: 2,
                    amount: None,
                },
            ],
            description: Some("指定人员 AA"),
            created_by_admin_id: Some(1),
        })
        .await
        .expect("custom user aa settlement should succeed");

    let non_registration_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM rs_user_activity WHERE activity_id = $1 AND user_id = 2",
    )
    .bind(&activity_id)
    .fetch_one(&pool)
    .await
    .expect("registration count should query");

    restore_user_account_snapshots(&pool, &original_accounts).await;
    cleanup_activity(&pool, &activity_id).await;

    assert_eq!(summary.settled_user_count, 2);
    assert_eq!(summary.aa_fee, Some(Decimal::new(4500, 2)));
    assert_eq!(
        summary
            .items
            .iter()
            .map(|item| (item.user_id, item.fee))
            .collect::<Vec<_>>(),
        vec![
            (2, Some(Decimal::new(4500, 2))),
            (4, Some(Decimal::new(4500, 2))),
        ]
    );
    assert_eq!(non_registration_count, 0);
}

#[tokio::test]
async fn settle_activity_expense_supports_manual_attendee_amounts() {
    let _guard = billing_test_guard().await;
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    let repo = PostgresBillingRepository::new(pool.clone());
    let activity_id = Uuid::new_v4().to_string();
    let original_accounts = load_user_account_snapshots(&pool, &[4, 18]).await;

    create_finished_activity_with_registrations(&pool, &activity_id, &[4, 18], &[2]).await;

    let summary = repo
        .settle_activity_expense_with_charges(SettlementRequest {
            activity_id: &activity_id,
            mode: SettlementMode::Manual,
            participant_scope: SettlementParticipantScope::RegisteredAttendees,
            total_amount: Decimal::new(10000, 2),
            charges: &[
                SettlementCharge {
                    user_id: 4,
                    amount: Some(Decimal::new(3000, 2)),
                },
                SettlementCharge {
                    user_id: 18,
                    amount: Some(Decimal::new(7000, 2)),
                },
            ],
            description: Some("出勤人员手动金额"),
            created_by_admin_id: Some(1),
        })
        .await
        .expect("manual attendee settlement should succeed");

    restore_user_account_snapshots(&pool, &original_accounts).await;
    cleanup_activity(&pool, &activity_id).await;

    assert_eq!(summary.total_amount, Some(Decimal::new(10000, 2)));
    assert_eq!(summary.aa_fee, None);
    assert_eq!(
        summary
            .items
            .iter()
            .map(|item| (item.user_id, item.fee))
            .collect::<Vec<_>>(),
        vec![
            (4, Some(Decimal::new(3000, 2))),
            (18, Some(Decimal::new(7000, 2))),
        ]
    );
}

#[tokio::test]
async fn settle_activity_expense_supports_manual_custom_user_amounts() {
    let _guard = billing_test_guard().await;
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    let repo = PostgresBillingRepository::new(pool.clone());
    let activity_id = Uuid::new_v4().to_string();
    let original_accounts = load_user_account_snapshots(&pool, &[4, 2]).await;

    create_finished_activity_with_registrations(&pool, &activity_id, &[4], &[18]).await;

    let summary = repo
        .settle_activity_expense_with_charges(SettlementRequest {
            activity_id: &activity_id,
            mode: SettlementMode::Manual,
            participant_scope: SettlementParticipantScope::CustomUsers,
            total_amount: Decimal::new(9000, 2),
            charges: &[
                SettlementCharge {
                    user_id: 4,
                    amount: Some(Decimal::new(5000, 2)),
                },
                SettlementCharge {
                    user_id: 2,
                    amount: Some(Decimal::new(4000, 2)),
                },
            ],
            description: Some("指定人员手动金额"),
            created_by_admin_id: Some(1),
        })
        .await
        .expect("manual custom settlement should succeed");

    let non_registration_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM rs_user_activity WHERE activity_id = $1 AND user_id = 2",
    )
    .bind(&activity_id)
    .fetch_one(&pool)
    .await
    .expect("registration count should query");

    restore_user_account_snapshots(&pool, &original_accounts).await;
    cleanup_activity(&pool, &activity_id).await;

    assert_eq!(summary.total_amount, Some(Decimal::new(9000, 2)));
    assert_eq!(summary.aa_fee, None);
    assert_eq!(
        summary
            .items
            .iter()
            .map(|item| (item.user_id, item.fee))
            .collect::<Vec<_>>(),
        vec![
            (2, Some(Decimal::new(4000, 2))),
            (4, Some(Decimal::new(5000, 2))),
        ]
    );
    assert_eq!(non_registration_count, 0);
}
