use chrono::{Duration, Local};
use registration_system_backend::activity::domain::Activity;
use registration_system_backend::challenge::adapters::PostgresChallengeRepository;
use registration_system_backend::challenge::ports::{
    ChallengeCommandRepository, ChallengeQueryRepository,
};
use sqlx::PgPool;
use uuid::Uuid;

fn test_database_url() -> Option<String> {
    let _ = dotenvy::from_filename(".env");
    std::env::var("DATABASE_URL").ok()
}

async fn ensure_activity_team_capacity_limit_column(pool: &PgPool) {
    sqlx::query("ALTER TABLE rs_activity ADD COLUMN IF NOT EXISTS team_capacity_limit INT NULL")
        .execute(pool)
        .await
        .expect("activity team_capacity_limit column should exist for challenge repository tests");
}

#[tokio::test]
async fn detail_returns_all_individual_participants() {
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    ensure_activity_team_capacity_limit_column(&pool).await;
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

    let challenge_id = Uuid::new_v4().to_string();
    let now = Local::now().naive_local();
    let start_time = now + Duration::days(3);
    let end_time = start_time + Duration::hours(2);

    sqlx::query(
        r#"
        SELECT setval(
            pg_get_serial_sequence('rs_user_info', 'id'),
            GREATEST((SELECT COALESCE(MAX(id), 0) FROM rs_user_info), 1)
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("user id sequence should align with existing data");

    let host_user_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_user_info (
            open_id, username, nickname, real_name, avatar_url, phone_number,
            is_manager, status, create_time, latest_login_date
        )
        VALUES ($1, 'detail-host', '详情场馆', '详情场馆', '', '', 1, 1, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(format!("test-detail-host-{challenge_id}"))
    .fetch_one(&pool)
    .await
    .expect("host user should insert");

    let mut participant_ids = Vec::new();
    for index in 0..13 {
        let user_id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO rs_user_info (
                open_id, username, nickname, real_name, avatar_url, phone_number,
                is_manager, status, create_time, latest_login_date
            )
            VALUES ($1, $2, $3, $3, $4, '', 1, 1, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(format!("test-detail-participant-{challenge_id}-{index}"))
        .bind(format!("detail-participant-{index}"))
        .bind(format!("报名用户{index}"))
        .bind(format!("https://example.com/avatar-{index}.png"))
        .fetch_one(&pool)
        .await
        .expect("participant should insert");
        participant_ids.push(user_id);
    }

    sqlx::query(
        r#"
        INSERT INTO rs_challenges (
            id, title, kind, host_team_id, host_user_id, holding_date, start_time, end_time,
            location, players_per_team, status, created_at, updated_at
        ) VALUES (
            $1, '散人详情名单测试', 'individual', NULL, $2, $3, $4, $5,
            '详情名单球场', 8, 'open', NOW(), NOW()
        )
        "#,
    )
    .bind(&challenge_id)
    .bind(host_user_id)
    .bind(start_time)
    .bind(start_time)
    .bind(end_time)
    .execute(&pool)
    .await
    .expect("challenge should insert");

    for user_id in &participant_ids {
        sqlx::query(
            r#"
            INSERT INTO rs_challenge_individual_acceptances (challenge_id, user_id, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            "#,
        )
        .bind(&challenge_id)
        .bind(user_id)
        .execute(&pool)
        .await
        .expect("acceptance should insert");
    }

    let detail = repo
        .get_detail(&challenge_id, None)
        .await
        .expect("detail should load")
        .expect("detail should exist");

    sqlx::query("DELETE FROM rs_challenges WHERE id = $1")
        .bind(&challenge_id)
        .execute(&pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_user_info WHERE id = ANY($1)")
        .bind(&participant_ids)
        .execute(&pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_user_info WHERE id = $1")
        .bind(host_user_id)
        .execute(&pool)
        .await
        .ok();

    assert_eq!(detail.summary.accepted_count, 13);
    assert_eq!(detail.individual_participants.len(), 13);
    assert_eq!(
        detail.individual_participants[0].display_name,
        "报名用户0"
    );
    assert_eq!(
        detail.individual_participants[12].avatar_url.as_deref(),
        Some("https://example.com/avatar-12.png")
    );
}

#[tokio::test]
async fn accept_with_activity_deduplicates_shared_team_members() {
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = PgPool::connect(&database_url)
        .await
        .expect("test database should connect");
    ensure_activity_team_capacity_limit_column(&pool).await;
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
        ALTER TABLE rs_activity
            ADD COLUMN IF NOT EXISTS match_kind VARCHAR(16) NOT NULL DEFAULT 'external'
        "#,
    )
    .execute(&pool)
    .await
    .expect("activity match_kind column should exist in test database");

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

    let team_suffix = Uuid::new_v4().to_string();
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
        home_team_id: None,
        away_team_id: None,
        color: None,
        opposing_color: None,
        players_per_team: Some(8),
        team_capacity_limit: None,
            match_kind: Some("external".to_string()),
        source_activity_id: None,
        team_registration_count: None,
        registration_preview: Default::default(),
        team_checkin_configs: vec![],
        created_at: now,
        updated_at: now,
    };

    sqlx::query(
        r#"
        SELECT setval(
            pg_get_serial_sequence('rs_user_info', 'id'),
            GREATEST((SELECT COALESCE(MAX(id), 0) FROM rs_user_info), 1)
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("user id sequence should align with existing data");

    let host_captain_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_user_info (
            open_id, username, nickname, real_name, avatar_url, phone_number,
            is_manager, status, create_time, latest_login_date
        )
        VALUES ($1, 'shared-host-captain', '共享主队队长', '共享主队队长', '', '', 1, 1, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(format!("test-shared-host-{challenge_id}"))
    .fetch_one(&pool)
    .await
    .expect("host captain should insert");
    let shared_member_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_user_info (
            open_id, username, nickname, real_name, avatar_url, phone_number,
            is_manager, status, create_time, latest_login_date
        )
        VALUES ($1, 'shared-member', '共享队员', '共享队员', '', '', 1, 1, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(format!("test-shared-member-{challenge_id}"))
    .fetch_one(&pool)
    .await
    .expect("shared member should insert");
    let guest_captain_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_user_info (
            open_id, username, nickname, real_name, avatar_url, phone_number,
            is_manager, status, create_time, latest_login_date
        )
        VALUES ($1, 'shared-guest-captain', '共享客队队长', '共享客队队长', '', '', 1, 1, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(format!("test-shared-guest-{challenge_id}"))
    .fetch_one(&pool)
    .await
    .expect("guest captain should insert");

    let host_team_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_teams (name, captain_id, status, created_at, updated_at, credit_score)
        VALUES ($1, $2, 1, NOW(), NOW(), 60)
        RETURNING id
        "#,
    )
    .bind(format!("共享主队-{}", &team_suffix[..8]))
    .bind(host_captain_id)
    .fetch_one(&pool)
    .await
    .expect("host team should insert");
    let guest_team_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO rs_teams (name, captain_id, status, created_at, updated_at, credit_score)
        VALUES ($1, $2, 1, NOW(), NOW(), 65)
        RETURNING id
        "#,
    )
    .bind(format!("共享客队-{}", &team_suffix[..8]))
    .bind(guest_captain_id)
    .fetch_one(&pool)
    .await
    .expect("guest team should insert");
    let activity = Activity {
        home_team_id: Some(host_team_id),
        away_team_id: Some(guest_team_id),
        ..activity
    };

    sqlx::query(
        r#"
        INSERT INTO rs_team_members (team_id, user_id, role, status, joined_at, created_at, updated_at)
        VALUES
            ($1, $3, 'captain', 1, NOW(), NOW(), NOW()),
            ($1, $4, 'leader', 1, NOW(), NOW(), NOW()),
            ($2, $5, 'captain', 1, NOW(), NOW(), NOW()),
            ($2, $4, 'leader', 1, NOW(), NOW(), NOW())
        "#,
    )
    .bind(host_team_id)
    .bind(guest_team_id)
    .bind(host_captain_id)
    .bind(shared_member_id)
    .bind(guest_captain_id)
    .execute(&pool)
    .await
    .expect("team members should insert");

    sqlx::query(
        r#"
        INSERT INTO rs_challenges (
            id, title, host_team_id, host_user_id, holding_date, start_time, end_time, location,
            players_per_team, status, created_at, updated_at
        ) VALUES (
            $1, '共享队员约队测试', $2, $6, $3, $4, $5, '共享队员验收球场',
            8, 'open', NOW(), NOW()
        )
        "#,
    )
    .bind(&challenge_id)
    .bind(host_team_id)
    .bind(start_time)
    .bind(start_time)
    .bind(end_time)
    .bind(host_captain_id)
    .execute(&pool)
    .await
    .expect("challenge should insert");

    let result = repo
        .accept_with_activity(&challenge_id, guest_team_id, guest_captain_id, &activity)
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
        .bind(host_team_id)
        .bind(guest_team_id)
        .execute(&pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_teams WHERE id IN ($1, $2)")
        .bind(host_team_id)
        .bind(guest_team_id)
        .execute(&pool)
        .await
        .ok();
    sqlx::query("DELETE FROM rs_user_info WHERE id IN ($1, $2, $3)")
        .bind(host_captain_id)
        .bind(shared_member_id)
        .bind(guest_captain_id)
        .execute(&pool)
        .await
        .ok();

    let challenge = result.expect("shared team members should not break accept flow");
    assert_eq!(challenge.activity_id.as_deref(), Some(activity_id.as_str()));
    assert_eq!(registration_count, 3);
    assert_eq!(distinct_user_count, 3);
}
