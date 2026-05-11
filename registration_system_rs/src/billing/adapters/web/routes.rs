use crate::billing::adapters::web::handlers::{
    activities_billing_handler, auto_calculate_fee_handler, balance_calibrations_handler,
    calculate_penalties_handler, calibrate_balance_handler, create_activity_order_handler,
    game_expense_handler, get_activity_settlement_handler, get_my_balance_handler,
    get_order_handler, get_user_balance_handler, list_my_billings_handler, list_orders_handler,
    penalty_handler, recharge_handler, settle_activity_expense_handler, transactions_handler,
    user_billing_flow_handler, user_transactions_handler, users_billing_handler,
};
use crate::bootstrap::app::AppState;
use axum::{
    Router,
    routing::{get, post},
};

pub fn create_account_router() -> Router<AppState> {
    Router::new()
        .route("/balance", get(get_my_balance_handler))
        .route("/:user_id/balance", get(get_user_balance_handler))
        .route("/recharge", post(recharge_handler))
        .route("/game-expense", post(game_expense_handler))
        .route("/penalty", post(penalty_handler))
        .route("/calibrate-balance", post(calibrate_balance_handler))
        .route("/balance-calibrations", get(balance_calibrations_handler))
        .route("/transactions", get(transactions_handler))
        .route("/:user_id/transactions", get(user_transactions_handler))
}

pub fn create_order_router() -> Router<AppState> {
    Router::new()
        .route(
            "/orders",
            post(create_activity_order_handler).get(list_orders_handler),
        )
        .route("/orders/:id", get(get_order_handler))
        .route(
            "/activities/:id/settlement",
            get(get_activity_settlement_handler).post(settle_activity_expense_handler),
        )
        .route("/orders/auto-calculate", post(auto_calculate_fee_handler))
        .route(
            "/billing/calculate-penalties",
            post(calculate_penalties_handler),
        )
        .route("/activities/billing", get(activities_billing_handler))
        .route("/users/billing", get(users_billing_handler))
        .route("/my-billing-flow", get(list_my_billings_handler))
        .route(
            "/users/:user_id/billing-flow",
            get(user_billing_flow_handler),
        )
}
