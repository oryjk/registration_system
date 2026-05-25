use crate::bootstrap::app::AppState;
use crate::payment::adapters::web::handlers::{
    cancel_order_handler, create_challenge_payment_order_handler, create_recharge_order_handler,
    create_team_membership_order_handler, get_order_status_handler, list_orders_handler,
    sync_order_status_handler, wx_notify_handler,
};
use axum::{
    Router,
    routing::{get, post},
};

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/recharge", post(create_recharge_order_handler))
        .route(
            "/team-membership",
            post(create_team_membership_order_handler),
        )
        .route(
            "/challenge-individual",
            post(create_challenge_payment_order_handler),
        )
        .route("/order/:order_no", get(get_order_status_handler))
        .route("/sync/:order_no", post(sync_order_status_handler))
        .route("/orders", get(list_orders_handler))
        .route("/wx-notify", post(wx_notify_handler))
        .route("/cancel", post(cancel_order_handler))
}
