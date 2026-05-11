use crate::bootstrap::app::AppState;
use crate::notification::adapters::{PostgresNotificationRepository, create_router};
use crate::notification::application::NotificationService;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_notification_service(pool: &PgPool) -> Arc<NotificationService> {
    let repository = Arc::new(PostgresNotificationRepository::new(pool.clone()));
    Arc::new(NotificationService::new(repository))
}

pub fn build_notification_router() -> Router<AppState> {
    create_router()
}
