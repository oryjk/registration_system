use crate::bootstrap::app::AppState;
use crate::system::adapters::web::handlers::{
    get_map_preview_settings_handler, get_map_settings_handler,
    get_mini_app_runtime_config_handler, update_map_settings_handler,
    update_mini_app_runtime_config_handler,
};
use axum::{
    Router,
    routing::{get, patch},
};

pub fn create_admin_router() -> Router<AppState> {
    Router::new()
        .route(
            "/map-preview-settings",
            get(get_map_preview_settings_handler),
        )
        .route("/map-settings", get(get_map_settings_handler))
        .route("/map-settings", patch(update_map_settings_handler))
        .route(
            "/mini-app-runtime-config",
            get(get_mini_app_runtime_config_handler).patch(update_mini_app_runtime_config_handler),
        )
}

pub fn create_app_router() -> Router<AppState> {
    Router::new().route(
        "/mini-app-runtime-config",
        get(get_mini_app_runtime_config_handler),
    )
}
