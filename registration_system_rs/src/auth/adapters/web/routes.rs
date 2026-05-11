use crate::auth::adapters::web::handlers::{
    delete_admin_handler, list_admins_handler, login_handler, logout_handler, register_handler,
    update_admin_status_handler, verify_handler,
};
use crate::bootstrap::app::AppState;
use axum::{
    Router,
    routing::{delete, get, patch, post},
};

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login_handler))
        .route("/verify", post(verify_handler))
        .route("/register", post(register_handler))
        .route("/logout", post(logout_handler))
        .route("/admins", get(list_admins_handler))
        .route("/admins/:id/status", patch(update_admin_status_handler))
        .route("/admins/:id", delete(delete_admin_handler))
}
