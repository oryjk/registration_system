use crate::bootstrap::app::AppState;
use crate::notification::adapters::{PostgresNotificationRepository, create_router};
use crate::notification::application::NotificationService;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_notification_service(pool: &PgPool) -> Arc<NotificationService> {
    let query_repository = Arc::new(PostgresNotificationRepository::new(pool.clone()));
    let command_repository = Arc::new(PostgresNotificationRepository::new(pool.clone()));
    Arc::new(NotificationService::new(
        query_repository,
        command_repository,
    ))
}

pub fn build_notification_router() -> Router<AppState> {
    create_router()
}
