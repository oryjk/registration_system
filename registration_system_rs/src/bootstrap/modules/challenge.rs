use crate::bootstrap::app::AppState;
use crate::challenge::adapters::{PostgresChallengeRepository, create_router};
use crate::challenge::application::ChallengeService;
use crate::notification::application::NotificationService;
use crate::team::adapters::PostgresTeamRepository;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_challenge_service(
    pool: &PgPool,
    notification_service: Arc<NotificationService>,
) -> Arc<ChallengeService> {
    let repository = Arc::new(PostgresChallengeRepository::new(pool.clone()));
    let team_repository = Arc::new(PostgresTeamRepository::new(pool.clone()));
    Arc::new(ChallengeService::new(
        repository,
        team_repository,
        notification_service,
    ))
}

pub fn build_challenge_router() -> Router<AppState> {
    create_router()
}
