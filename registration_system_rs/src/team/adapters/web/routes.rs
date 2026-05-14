use crate::bootstrap::app::AppState;
use crate::team::adapters::web::handlers::{
    add_member_handler, admin_create_team_handler, admin_list_teams_handler,
    admin_team_detail_handler, assign_admin_handler, attendance_summary_handler,
    batch_remove_members_handler, batch_update_member_status_handler, create_team_handler,
    delete_team_handler, get_team_handler, join_team_handler, list_team_admins_handler,
    list_team_credit_transactions_handler, list_teams_handler, member_attendance_handler,
    my_teams_handler, password_info_handler, recharge_team_membership_handler,
    remove_member_handler, search_teams_handler, submit_activity_review_handler,
    team_credit_overview_handler, team_credit_penalty_handler, unassign_admin_handler,
    update_member_handler, update_team_handler, upload_team_logo_handler, user_teams_handler,
};
use axum::{
    Router,
    routing::{delete, get, patch, post},
};

fn shared_router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_team_handler).get(list_teams_handler))
        .route("/search", get(search_teams_handler))
        .route("/join", post(join_team_handler))
        .route("/my-teams", get(my_teams_handler))
        .route("/users/:user_id/teams", get(user_teams_handler))
        .route("/:id/password-info", get(password_info_handler))
        .route("/:id/credit", get(team_credit_overview_handler))
        .route(
            "/:id/credit/transactions",
            get(list_team_credit_transactions_handler),
        )
        .route("/:id/credit/reviews", post(submit_activity_review_handler))
        .route(
            "/:id/credit/membership-recharges",
            post(recharge_team_membership_handler),
        )
        .route("/:id/credit/penalties", post(team_credit_penalty_handler))
        .route("/:id/attendance-summary", get(attendance_summary_handler))
        .route("/:id/members", post(add_member_handler))
        .route("/:id/logo", post(upload_team_logo_handler))
        .route(
            "/:id/members/batch",
            delete(batch_remove_members_handler).patch(batch_update_member_status_handler),
        )
        .route(
            "/:id/members/:user_id",
            patch(update_member_handler).delete(remove_member_handler),
        )
        .route(
            "/:id/members/:user_id/attendance",
            get(member_attendance_handler),
        )
        .route(
            "/:id",
            get(get_team_handler)
                .patch(update_team_handler)
                .delete(delete_team_handler),
        )
}

fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/admin", post(admin_create_team_handler))
        .route("/admin-list", get(admin_list_teams_handler))
        // 管理后台：球队详情（队员含球员信息 + 管理员列表）
        .route("/:id/admin-detail", get(admin_team_detail_handler))
        // 管理后台：球队管理员分配
        .route(
            "/:id/admin-managers",
            get(list_team_admins_handler).post(assign_admin_handler),
        )
        .route(
            "/:id/admin-managers/:admin_id",
            delete(unassign_admin_handler),
        )
}

pub fn create_admin_router() -> Router<AppState> {
    shared_router().merge(admin_router())
}

pub fn create_app_router() -> Router<AppState> {
    shared_router()
}
