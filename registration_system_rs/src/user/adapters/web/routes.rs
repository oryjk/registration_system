use crate::bootstrap::app::AppState;
use crate::user::adapters::web::handlers::{
    admin_create_player_handler, admin_create_role_user_handler, admin_update_player_handler,
    attendance_ranking_for_user_handler, attendance_ranking_handler, bind_phone_number_handler,
    change_player_password_handler, current_user_handler, delete_user_handler,
    freeze_player_handler, get_my_activities_handler, get_my_attendance_handler,
    get_player_detail_handler, get_user_activities_handler, get_user_attendance_handler,
    get_user_info_by_id_handler, list_players_handler, list_user_infos_handler, list_users_handler,
    login_handler, password_login_handler, search_users_handler, unfreeze_player_handler,
    update_profile_handler, update_user_by_id_handler, upload_avatar_handler, verify_handler,
};
use axum::{
    Router,
    routing::{get, patch, post},
};

fn shared_router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login_handler))
        .route("/password-login", post(password_login_handler))
        .route("/verify", post(verify_handler))
        .route("/", get(list_users_handler))
        .route("/infos", get(list_user_infos_handler))
        .route("/search", get(search_users_handler))
        .route(
            "/info",
            get(current_user_handler).patch(update_profile_handler),
        )
        .route("/phone", patch(bind_phone_number_handler))
        .route("/avatar", post(upload_avatar_handler))
        .route("/info/:user_id", get(get_user_info_by_id_handler))
        .route("/activities", get(get_my_activities_handler))
        .route("/activities/:user_id", get(get_user_activities_handler))
        .route("/attendance", get(get_my_attendance_handler))
        .route("/attendance/:user_id", get(get_user_attendance_handler))
        .route("/attendance-ranking", get(attendance_ranking_handler))
        .route(
            "/attendance-ranking/:user_id",
            get(attendance_ranking_for_user_handler),
        )
}

fn admin_router() -> Router<AppState> {
    Router::new()
        .route(
            "/:user_id",
            patch(update_user_by_id_handler).delete(delete_user_handler),
        )
        // 管理后台：球员 CRUD + 冻结管理
        .route(
            "/players",
            get(list_players_handler).post(admin_create_player_handler),
        )
        .route("/players/role-users", post(admin_create_role_user_handler))
        .route(
            "/players/:user_id",
            get(get_player_detail_handler).patch(admin_update_player_handler),
        )
        .route(
            "/players/:user_id/password",
            patch(change_player_password_handler),
        )
        .route("/players/:user_id/freeze", post(freeze_player_handler))
        .route("/players/:user_id/unfreeze", post(unfreeze_player_handler))
}

pub fn create_admin_router() -> Router<AppState> {
    shared_router().merge(admin_router())
}

pub fn create_app_router() -> Router<AppState> {
    shared_router()
}
