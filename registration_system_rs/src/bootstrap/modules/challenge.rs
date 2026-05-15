use crate::bootstrap::app::AppState;
use crate::challenge::adapters::{PostgresChallengeRepository, create_router};
use crate::challenge::application::ChallengeService;
use crate::notification::application::NotificationService;
use crate::team::adapters::PostgresTeamQueryRepository;
use crate::user::adapters::PostgresUserRepository;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_challenge_service(
    pool: &PgPool,
    notification_service: Arc<NotificationService>,
) -> Arc<ChallengeService> {
    let query_repository = Arc::new(PostgresChallengeRepository::new(pool.clone()));
    let command_repository = Arc::new(PostgresChallengeRepository::new(pool.clone()));
    let team_repository = Arc::new(PostgresTeamQueryRepository::new(pool.clone()));
    let user_repository = Arc::new(PostgresUserRepository::new(pool.clone()));
    Arc::new(ChallengeService::new(
        query_repository,
        command_repository,
        team_repository,
        user_repository,
        notification_service,
    ))
}

pub fn build_challenge_router() -> Router<AppState> {
    create_router()
}
