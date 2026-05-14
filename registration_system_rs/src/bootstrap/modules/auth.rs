use crate::auth::adapters::{PostgresAdminUserRepository, create_router};
use crate::auth::application::AuthService;
use crate::bootstrap::app::AppState;
use crate::shared::ports::TokenServicePort;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_auth_service(
    pool: &PgPool,
    token_service: Arc<dyn TokenServicePort>,
) -> Arc<AuthService> {
    let query_repository = Arc::new(PostgresAdminUserRepository::new(pool.clone()));
    let command_repository = Arc::new(PostgresAdminUserRepository::new(pool.clone()));
    Arc::new(AuthService::new(
        query_repository,
        command_repository,
        token_service,
    ))
}

pub fn build_auth_router() -> Router<AppState> {
    create_router()
}
