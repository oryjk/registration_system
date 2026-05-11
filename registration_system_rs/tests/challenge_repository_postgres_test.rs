use chrono::{Duration, Local};
use registration_system_backend::activity::domain::Activity;
use registration_system_backend::challenge::adapters::PostgresChallengeRepository;
use registration_system_backend::challenge::ports::ChallengeRepository;
use sqlx::PgPool;
use uuid::Uuid;

fn test_database_url() -> Option<String> {
    let _ = dotenvy::from_filename(".env");
    std::env::var("DATABASE_URL").ok()
}

#[tokio::test]
async fn accept_with_activity_deduplicates_shared_team_members() {
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    let repo = PostgresChallengeRepository::new(pool.clone());

    sqlx::query(
        r#"
        ALTER TABLE rs_challenges
            ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'team'
        "#,
    )
    .execute(&pool)
    .await
    .expect("challenge kind column should exist in test database");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS rs_challenge_individual_acceptances (
            id BIGSERIAL PRIMARY KEY,
            challenge_id CHAR(36) NOT NULL REFERENCES rs_challenges (id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL REFERENCES rs_user_info (id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_challenge_individual_acceptance UNIQUE (challenge_id, user_id)
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("individual acceptance table should exist in test database");

    let host_team_id = Uuid::new_v4().to_string();
    let guest_team_id = Uuid::new_v4().to_string();
    let challenge_id = Uuid::new_v4().to_string();
    let activity_id = Uuid::new_v4().to_string();
    let now = Local::now().naive_local();
    let start_time = now + Duration::days(2);
    let end_time = start_time + Duration::hours(2);
    let activity = Activity {
        id: activity_id.clone(),
        cover: None,
        start_time,
        end_time,
        holding_date: start_time,
        location: "共享队员验收球场".to_string(),
        location_latitude: None,
        location_longitude: None,
        name: "共享队员约队".to_string(),
        opposing: Some("共享队员主队 vs 客队".to_string()),
        status: 0,
        description: Some("回归测试".to_string()),
        home_team_id: Some(host_team_id.clone()),
        away_team_id: Some(guest_team_id.clone()),
        color: None,
        opposing_color: None,
        players_per_team: Some(8),
        source_activity_id: None,
        team_registration_count: None,
        team_checkin_configs: vec![],
        created_at: now,
        updated_at: now,
    };

    sqlx::query(
        r#"
        INSERT INTO rs_teams (id, name, captain_id, status, created_at, updated_at, credit_score)
        VALUES ($1, $2, $3, 1, NOW(), NOW(), 60),
               ($4, $5, $6, 1, NOW(), NOW(), 65)
        "#,
    )
    .bind(&host_team_id)
    .bind(format!("共享主队-{}", &host_team_id[..8]))
    .bind(9101_i64)
    .bind(&guest_team_id)
    .bind(format!("共享客队-{}", &guest_team_id[..8]))
    .bind(4_i64)
    .execute(&pool)
    .await
    .expect("teams should insert");

    sqlx::query(
        r#"
        INSERT INTO rs_team_members (team_id, user_id, role, status, joined_at, created_at, updated_at)
        VALUES
            ($1, 9101, 'captain', 1, NOW(), NOW(), NOW()),
            ($1, 18, 'leader', 1, NOW(), NOW(), NOW()),
            ($2, 4, 'captain', 1, NOW(), NOW(), NOW()),
            ($2, 18, 'leader', 1, NOW(), NOW(), NOW())
        "#,
    )
    .bind(&host_team_id)
    .bind(&guest_team_id)
    .execute(&pool)
    .await
    .expect("team members should insert");

    sqlx::query(
        r#"
        INSERT INTO rs_challenges (
            id, title, host_team_id, host_user_id, holding_date, start_time, end_time, location,
            players_per_team, status, created_at, updated_at
        ) VALUES (
            $1, '共享队员约队测试', $2, 9101, $3, $4, $5, '共享队员验收球场',
            8, 'open', NOW(), NOW()
        )
        "#,
    )
    .bind(&challenge_id)
    .bind(&host_team_id)
    .bind(start_time)
    .bind(start_time)
    .bind(end_time)
    .execute(&pool)
    .await
    .expect("challenge should insert");

    let result = repo
        .accept_with_activity(&challenge_id, &guest_team_id, 4, &activity)
        .await;

    let registration_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM rs_user_activity WHERE activity_id = $1",
    )
    .bind(&activity_id)
    .fetch_one(&pool)
    .await
    .unwrap_or_default();
    let distinct_user_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT user_id) FROM rs_user_activity WHERE activity_id = $1",
    )
    .bind(&activity_id)
    .fetch_one(&pool)
    .await
    .unwrap_or_default();

    sqlx::query("DELETE FROM rs_challenges WHERE id = $1")
        .bind(&challenge_id)
        .execute(&pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_activity WHERE id = $1")
        .bind(&activity_id)
        .execute(&pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_team_members WHERE team_id IN ($1, $2)")
        .bind(&host_team_id)
        .bind(&guest_team_id)
        .execute(&pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_teams WHERE id IN ($1, $2)")
        .bind(&host_team_id)
        .bind(&guest_team_id)
        .execute(&pool)
        .await
        .ok();

    let challenge = result.expect("shared team members should not break accept flow");
    assert_eq!(challenge.activity_id.as_deref(), Some(activity_id.as_str()));
    assert_eq!(registration_count, 3);
    assert_eq!(distinct_user_count, 3);
}
