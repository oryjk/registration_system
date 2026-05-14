use crate::billing::adapters::{
    PostgresBillingActivityAccessPort, PostgresBillingRepository, create_account_router,
    create_order_router,
};
use crate::billing::application::BillingService;
use crate::bootstrap::app::AppState;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_billing_service(pool: &PgPool) -> Arc<BillingService> {
    let query_repository = Arc::new(PostgresBillingRepository::new(pool.clone()));
    let command_repository = Arc::new(PostgresBillingRepository::new(pool.clone()));
    let activity_access_port = Arc::new(PostgresBillingActivityAccessPort::new(pool.clone()));
    Arc::new(BillingService::new(
        query_repository,
        command_repository,
        activity_access_port,
    ))
}

pub fn build_account_router() -> Router<AppState> {
    create_account_router()
}

pub fn build_order_router() -> Router<AppState> {
    create_order_router()
}
