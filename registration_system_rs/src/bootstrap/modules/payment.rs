use crate::bootstrap::app::AppState;
use crate::bootstrap::config::AppConfig;
use crate::payment::adapters::{
    MockWxPayGateway, PostgresActivityPaymentAccessAdapter, PostgresPaymentOrderRepository,
    PostgresPaymentSettlementAdapter, RealWxPayGateway, create_router,
};
use crate::payment::application::PaymentService;
use crate::team::adapters::PostgresTeamQueryRepository;
use crate::user::adapters::PostgresUserRepository;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_payment_service(pool: &PgPool, app_config: &AppConfig) -> Arc<PaymentService> {
    let query_repository = Arc::new(PostgresPaymentOrderRepository::new(pool.clone()));
    let command_repository = Arc::new(PostgresPaymentOrderRepository::new(pool.clone()));
    let settlement_port = Arc::new(PostgresPaymentSettlementAdapter::new(pool.clone()));
    let activity_payment_access_port =
        Arc::new(PostgresActivityPaymentAccessAdapter::new(pool.clone()));
    let team_repository = Arc::new(PostgresTeamQueryRepository::new(pool.clone()));
    let user_repository = Arc::new(PostgresUserRepository::new(pool.clone()));
    let wx_pay_gateway: Arc<dyn crate::payment::ports::WxPayGateway> = if app_config.wx_pay.use_mock
        || app_config.wx.app_id.is_empty()
        || app_config.wx_pay.mch_id.is_empty()
        || app_config.wx_pay.api_key.is_empty()
    {
        Arc::new(MockWxPayGateway)
    } else {
        Arc::new(RealWxPayGateway::new(
            app_config.wx.app_id.clone(),
            app_config.wx_pay.mch_id.clone(),
            app_config.wx_pay.api_key.clone(),
            app_config.wx_pay.api_base_url.clone(),
            app_config.payment_notify_url(),
        ))
    };

    Arc::new(PaymentService::new(
        query_repository,
        command_repository,
        settlement_port,
        activity_payment_access_port,
        wx_pay_gateway,
        team_repository,
        user_repository,
    ))
}

pub fn build_payment_router() -> Router<AppState> {
    create_router()
}
