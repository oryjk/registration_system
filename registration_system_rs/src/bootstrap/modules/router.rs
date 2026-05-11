use crate::activity::application::ActivityService;
use crate::auth::application::AuthService;
use crate::billing::application::BillingService;
use crate::bootstrap::app::AppState;
use crate::bootstrap::config::AppConfig;
use crate::bootstrap::modules::activity::{
    build_activity_service, build_admin_activity_router, build_app_activity_router,
};
use crate::bootstrap::modules::auth::{build_auth_router, build_auth_service};
use crate::bootstrap::modules::billing::{
    build_account_router, build_billing_service, build_order_router,
};
use crate::bootstrap::modules::challenge::{build_challenge_router, build_challenge_service};
use crate::bootstrap::modules::notification::{
    build_notification_router, build_notification_service,
};
use crate::bootstrap::modules::payment::{build_payment_router, build_payment_service};
use crate::bootstrap::modules::system::{
    build_admin_system_router, build_app_system_router, build_system_service,
    build_system_settings_repository,
};
use crate::bootstrap::modules::team::{
    build_admin_team_router, build_app_team_router, build_team_service,
};
use crate::bootstrap::modules::user::{
    build_admin_user_router, build_app_user_router, build_user_service,
};
use crate::bootstrap::modules::wx::{build_wx_router, build_wx_service};
use crate::challenge::application::ChallengeService;
use crate::notification::application::NotificationService;
use crate::payment::application::PaymentService;
use crate::shared::ports::TokenServicePort;
use crate::system::application::SystemSettingsService;
use crate::team::application::TeamService;
use crate::user::application::UserService;
use crate::wx::application::WxService;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppServices {
    pub auth_service: Arc<AuthService>,
    pub user_service: Arc<UserService>,
    pub team_service: Arc<TeamService>,
    pub activity_service: Arc<ActivityService>,
    pub challenge_service: Arc<ChallengeService>,
    pub notification_service: Arc<NotificationService>,
    pub billing_service: Arc<BillingService>,
    pub wx_service: Arc<WxService>,
    pub payment_service: Arc<PaymentService>,
    pub system_settings_service: Arc<SystemSettingsService>,
}

pub fn build_app_services(
    pool: &PgPool,
    config: &AppConfig,
    token_service: Arc<dyn TokenServicePort>,
) -> AppServices {
    let billing_service = build_billing_service(pool);
    let notification_service = build_notification_service(pool);
    let system_settings_repository = build_system_settings_repository(pool);

    AppServices {
        auth_service: build_auth_service(pool, token_service.clone()),
        user_service: build_user_service(pool, token_service),
        team_service: build_team_service(pool),
        activity_service: build_activity_service(pool, config, system_settings_repository.clone()),
        challenge_service: build_challenge_service(pool, notification_service.clone()),
        notification_service,
        billing_service,
        wx_service: build_wx_service(config),
        payment_service: build_payment_service(pool, config),
        system_settings_service: build_system_service(system_settings_repository, config),
    }
}

pub fn assemble_api_router() -> Router<AppState> {
    // 后台管理端统一前缀 /api/admin
    let admin_router = Router::new()
        .nest("/auth", build_auth_router())
        .nest("/users", build_admin_user_router())
        .nest("/teams", build_admin_team_router())
        .nest("/activities", build_admin_activity_router())
        .nest("/challenges", build_challenge_router())
        .nest("/account", build_account_router())
        .nest("/orders", build_order_router())
        .nest("/system", build_admin_system_router())
        .nest("/wx", build_wx_router())
        .nest("/payment", build_payment_router());

    // 小程序端统一前缀 /api
    let app_router = Router::new()
        .nest("/user", build_app_user_router())
        .nest("/teams", build_app_team_router())
        .nest("/activity", build_app_activity_router())
        .nest("/challenges", build_challenge_router())
        .nest("/notifications", build_notification_router())
        .nest("/account", build_account_router())
        .nest("/order", build_order_router())
        .nest("/system", build_app_system_router())
        .nest("/wx", build_wx_router())
        .nest("/payment", build_payment_router());

    Router::new()
        .nest("/api/admin", admin_router)
        .nest("/api", app_router)
}
