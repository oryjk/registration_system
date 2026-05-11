use crate::bootstrap::app::AppState;
use crate::notification::adapters::web::handlers::{
    list_notifications_handler, mark_all_read_handler, unread_count_handler,
};
use axum::{
    Router,
    routing::{get, post},
};

pub fn create_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_notifications_handler))
        .route("/unread-count", get(unread_count_handler))
        .route("/read-all", post(mark_all_read_handler))
}
