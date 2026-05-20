use chrono::{Duration, Local};
use registration_system_backend::activity::adapters::PostgresActivityRepository;
use registration_system_backend::activity::ports::ActivityQueryRepository;
use sqlx::PgPool;
use uuid::Uuid;

fn test_database_url() -> Option<String> {
    let _ = dotenvy::from_filename(".env");
    std::env::var("DATABASE_URL").ok()
}

async fn delete_activity(pool: &PgPool, activity_id: &str) {
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

#[tokio::test]
async fn team_registration_scope_includes_direct_team_activity() {
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    let repo = PostgresActivityRepository::new(pool.clone());
    let activity_id = Uuid::new_v4().to_string();
    let team_name = format!("活动报名范围测试队-{}", Uuid::new_v4());
    let now = Local::now().naive_local();

    let team_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_teams (name, description, status, created_at, updated_at)
        VALUES ($1, '活动报名范围回归测试', 1, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(&team_name)
    .fetch_one(&pool)
    .await
    .expect("team should insert");

    sqlx::query(
        r#"
        INSERT INTO rs_activity (
            id, start_time, end_time, holding_date, location, name, status,
            home_team_id, source_activity_id, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, '活动报名范围测试球场', '直接球队活动报名范围测试', 0,
            $5, NULL, NOW(), NOW()
        )
        "#,
    )
    .bind(&activity_id)
    .bind(now + Duration::days(2))
    .bind(now + Duration::days(2) + Duration::hours(2))
    .bind(now + Duration::days(2))
    .bind(team_id)
    .execute(&pool)
    .await
    .expect("activity should insert");

    let page = repo
        .list_page(Some(0), Some("team"), 1, 100)
        .await
        .expect("team scope should query");

    delete_activity(&pool, &activity_id).await;
    sqlx::query("DELETE FROM rs_teams WHERE id = $1")
        .bind(team_id)
        .execute(&pool)
        .await
        .ok();

    assert!(
        page.items.iter().any(|activity| activity.id == activity_id),
        "team scope should include activities owned by a team even when source_activity_id is NULL"
    );
}
