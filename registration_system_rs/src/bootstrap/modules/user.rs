use crate::bootstrap::app::AppState;
use crate::shared::ports::TokenServicePort;
use crate::team::adapters::{PostgresTeamCommandRepository, PostgresTeamQueryRepository};
use crate::user::adapters::{PostgresUserRepository, create_admin_router, create_app_router};
use crate::user::application::UserService;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_user_service(
    pool: &PgPool,
    token_service: Arc<dyn TokenServicePort>,
) -> Arc<UserService> {
    let query_repository = Arc::new(PostgresUserRepository::new(pool.clone()));
    let command_repository = Arc::new(PostgresUserRepository::new(pool.clone()));
    let team_query_repository = Arc::new(PostgresTeamQueryRepository::new(pool.clone()));
    let team_command_repository = Arc::new(PostgresTeamCommandRepository::new(pool.clone()));
    Arc::new(UserService::new(
        query_repository,
        command_repository,
        team_query_repository,
        team_command_repository,
        token_service,
    ))
}

pub fn build_admin_user_router() -> Router<AppState> {
    create_admin_router()
}

pub fn build_app_user_router() -> Router<AppState> {
    create_app_router()
}
