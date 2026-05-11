use crate::bootstrap::app::AppState;
use crate::wx::adapters::web::handlers::{
    get_access_token_handler, get_phone_number_handler, login_handler,
};
use axum::{
    Router,
    routing::{get, post},
};

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login_handler))
        .route("/getAccessToken", get(get_access_token_handler))
        .route("/getPhoneNumber", post(get_phone_number_handler))
}
