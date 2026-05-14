use crate::activity::adapters::PostgresActivityRepository;
use crate::bootstrap::app::AppState;
use crate::team::adapters::{
    PostgresTeamCommandRepository, PostgresTeamQueryRepository, create_admin_router,
    create_app_router,
};
use crate::team::application::TeamService;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_team_service(pool: &PgPool) -> Arc<TeamService> {
    let query_repository = Arc::new(PostgresTeamQueryRepository::new(pool.clone()));
    let command_repository = Arc::new(PostgresTeamCommandRepository::new(pool.clone()));
    let activity_repository = Arc::new(PostgresActivityRepository::new(pool.clone()));
    Arc::new(TeamService::new(
        query_repository,
        command_repository,
        activity_repository,
    ))
}

pub fn build_admin_team_router() -> Router<AppState> {
    create_admin_router()
}

pub fn build_app_team_router() -> Router<AppState> {
    create_app_router()
}
