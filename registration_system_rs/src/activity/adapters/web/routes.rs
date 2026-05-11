use crate::activity::adapters::web::handlers::{
    admin_register_user_handler, backfill_activity_handler, batch_update_stand_handler,
    cancel_team_registration_handler, check_ongoing_handler, create_activity_handler,
    delete_activities_handler, delete_user_registration_handler, get_activity_handler,
    list_activities_handler, list_activity_users_handler, list_registrations_with_info_handler,
    resolve_location_handler, search_locations_handler, submit_activity_checkin_handler,
    update_activity_handler, update_my_stand_handler, update_status_handler,
    update_team_checkin_config_handler, update_team_registration_handler,
    update_user_stand_handler,
};
use crate::bootstrap::app::AppState;
use axum::{
    Router,
    routing::{delete, get, patch, post},
};

fn shared_router() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(list_activities_handler).post(create_activity_handler),
        )
        .route("/create", post(create_activity_handler))
        .route("/infos", get(list_activities_handler))
        .route("/check-ongoing", get(check_ongoing_handler))
        .route("/location-search", get(search_locations_handler))
        .route("/location-resolve", get(resolve_location_handler))
        .route("/:activity_id/my-stand", patch(update_my_stand_handler))
        .route(
            "/:activity_id/team-registration",
            post(update_team_registration_handler).delete(cancel_team_registration_handler),
        )
        .route(
            "/:activity_id/check-in-config",
            patch(update_team_checkin_config_handler),
        )
        .route(
            "/:activity_id/check-in",
            post(submit_activity_checkin_handler),
        )
        .route("/:activity_id/users", get(list_activity_users_handler))
        .route(
            "/:activity_id",
            get(get_activity_handler).patch(update_activity_handler),
        )
}

fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/batch", delete(delete_activities_handler))
        .route(
            "/:activity_id/user/:user_id/stand",
            patch(update_user_stand_handler),
        )
        .route(
            "/:activity_id/user/:user_id/registration",
            delete(delete_user_registration_handler),
        )
        .route("/:activity_id/status", patch(update_status_handler))
        .route("/:activity_id/backfill", post(backfill_activity_handler))
        .route(
            "/:activity_id/registrations",
            get(list_registrations_with_info_handler).post(admin_register_user_handler),
        )
        .route(
            "/:activity_id/registrations/batch",
            patch(batch_update_stand_handler),
        )
}

pub fn create_admin_router() -> Router<AppState> {
    shared_router().merge(admin_router())
}

pub fn create_app_router() -> Router<AppState> {
    shared_router()
}
