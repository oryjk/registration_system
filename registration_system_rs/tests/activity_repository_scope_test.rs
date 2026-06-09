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

async fn ensure_activity_team_capacity_limit_column(pool: &PgPool) {
    sqlx::query("ALTER TABLE rs_activity ADD COLUMN IF NOT EXISTS team_capacity_limit INT NULL")
        .execute(pool)
        .await
        .expect("activity team_capacity_limit column should exist for repository tests");
}

#[tokio::test]
async fn team_registration_scope_includes_direct_team_activity() {
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    ensure_activity_team_capacity_limit_column(&pool).await;
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
        .list_page(Some(0), Some("team"), None, None, 1, 100)
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

#[tokio::test]
async fn activity_list_can_filter_by_team_id() {
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    ensure_activity_team_capacity_limit_column(&pool).await;
    let repo = PostgresActivityRepository::new(pool.clone());
    let target_activity_id = Uuid::new_v4().to_string();
    let other_activity_id = Uuid::new_v4().to_string();
    let team_name = format!("活动球队过滤测试队-{}", Uuid::new_v4());
    let other_team_name = format!("活动球队过滤其他队-{}", Uuid::new_v4());
    let now = Local::now().naive_local();

    let team_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_teams (name, description, status, created_at, updated_at)
        VALUES ($1, '活动球队过滤回归测试', 1, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(&team_name)
    .fetch_one(&pool)
    .await
    .expect("team should insert");

    let other_team_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_teams (name, description, status, created_at, updated_at)
        VALUES ($1, '活动球队过滤回归测试', 1, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(&other_team_name)
    .fetch_one(&pool)
    .await
    .expect("other team should insert");

    for (activity_id, activity_team_id, activity_name) in [
        (&target_activity_id, team_id, "目标球队活动"),
        (&other_activity_id, other_team_id, "其他球队活动"),
    ] {
        sqlx::query(
            r#"
            INSERT INTO rs_activity (
                id, start_time, end_time, holding_date, location, name, status,
                home_team_id, source_activity_id, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, '活动球队过滤测试球场', $5, 0,
                $6, NULL, NOW(), NOW()
            )
            "#,
        )
        .bind(activity_id)
        .bind(now + Duration::days(2))
        .bind(now + Duration::days(2) + Duration::hours(2))
        .bind(now + Duration::days(2))
        .bind(activity_name)
        .bind(activity_team_id)
        .execute(&pool)
        .await
        .expect("activity should insert");
    }

    let page = repo
        .list_page(Some(0), Some("team"), Some(team_id), None, 1, 100)
        .await
        .expect("team id filter should query");

    delete_activity(&pool, &target_activity_id).await;
    delete_activity(&pool, &other_activity_id).await;
    sqlx::query("DELETE FROM rs_teams WHERE id = ANY($1)")
        .bind([team_id, other_team_id])
        .execute(&pool)
        .await
        .ok();

    assert!(
        page.items
            .iter()
            .any(|activity| activity.id == target_activity_id),
        "team_id filter should include activities where the team is home or away"
    );
    assert!(
        !page
            .items
            .iter()
            .any(|activity| activity.id == other_activity_id),
        "team_id filter should exclude activities from other teams"
    );
}

#[tokio::test]
async fn activity_list_can_filter_current_team_future_activities() {
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    ensure_activity_team_capacity_limit_column(&pool).await;
    let repo = PostgresActivityRepository::new(pool.clone());
    let past_activity_id = Uuid::new_v4().to_string();
    let future_activity_id = Uuid::new_v4().to_string();
    let team_name = format!("首页未来活动测试队-{}", Uuid::new_v4());
    let now = Local::now().naive_local();

    let team_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_teams (name, description, status, created_at, updated_at)
        VALUES ($1, '首页未来活动回归测试', 1, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(&team_name)
    .fetch_one(&pool)
    .await
    .expect("team should insert");

    for (activity_id, holding_date, activity_name) in [
        (&past_activity_id, now - Duration::days(2), "历史球队活动"),
        (&future_activity_id, now + Duration::days(2), "未来球队活动"),
    ] {
        sqlx::query(
            r#"
            INSERT INTO rs_activity (
                id, start_time, end_time, holding_date, location, name, status,
                home_team_id, source_activity_id, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, '首页未来活动测试球场', $5, 0,
                $6, NULL, NOW(), NOW()
            )
            "#,
        )
        .bind(activity_id)
        .bind(holding_date)
        .bind(holding_date + Duration::hours(2))
        .bind(holding_date)
        .bind(activity_name)
        .bind(team_id)
        .execute(&pool)
        .await
        .expect("activity should insert");
    }

    let page = repo
        .list_page(Some(0), Some("team"), Some(team_id), Some(now), 1, 10)
        .await
        .expect("future activity filter should query");

    delete_activity(&pool, &past_activity_id).await;
    delete_activity(&pool, &future_activity_id).await;
    sqlx::query("DELETE FROM rs_teams WHERE id = $1")
        .bind(team_id)
        .execute(&pool)
        .await
        .ok();

    assert!(
        page.items
            .iter()
            .any(|activity| activity.id == future_activity_id),
        "future activity should be included"
    );
    assert!(
        !page
            .items
            .iter()
            .any(|activity| activity.id == past_activity_id),
        "past activity should be filtered by holding_after"
    );
}
