use crate::activity::adapters::web::ActivityApiDoc;
use crate::auth::adapters::web::AuthApiDoc;
use crate::billing::adapters::web::{AccountApiDoc, OrderApiDoc};
use crate::challenge::adapters::web::ChallengeApiDoc;
use crate::notification::adapters::web::NotificationApiDoc;
use crate::payment::adapters::web::PaymentApiDoc;
use crate::system::adapters::web::SystemApiDoc;
use crate::team::adapters::web::TeamApiDoc;
use crate::user::adapters::web::UserApiDoc;
use crate::wx::adapters::web::WxApiDoc;
use axum::Json;
use axum::Router;
use utoipa::OpenApi as _;
use utoipa::openapi::{InfoBuilder, OpenApi, PathItem, Paths};
use utoipa_swagger_ui::SwaggerUi;

pub fn build_openapi_document() -> OpenApi {
    let mut openapi = OpenApi::new(
        InfoBuilder::new()
            .title("Registration System Backend API")
            .version(env!("CARGO_PKG_VERSION"))
            .description(Some("球队报名系统 Rust 重构版接口文档"))
            .build(),
        Paths::new(),
    );

    openapi.merge(OpenApi::default().nest("/api/admin", AuthApiDoc::openapi()));

    openapi.merge(filter_user_app_paths(
        OpenApi::default().nest("/api/user", UserApiDoc::openapi()),
    ));
    openapi.merge(OpenApi::default().nest("/api/admin/users", UserApiDoc::openapi()));

    openapi.merge(filter_team_app_paths(
        OpenApi::default().nest("/api/teams", TeamApiDoc::openapi()),
    ));
    openapi.merge(OpenApi::default().nest("/api/admin/teams", TeamApiDoc::openapi()));

    openapi.merge(filter_activity_app_paths(
        OpenApi::default().nest("/api/activity", ActivityApiDoc::openapi()),
    ));
    openapi.merge(OpenApi::default().nest("/api/admin/activities", ActivityApiDoc::openapi()));

    openapi.merge(OpenApi::default().nest("/api/challenges", ChallengeApiDoc::openapi()));
    openapi.merge(OpenApi::default().nest("/api/admin/challenges", ChallengeApiDoc::openapi()));

    openapi.merge(OpenApi::default().nest("/api/notifications", NotificationApiDoc::openapi()));

    openapi.merge(OpenApi::default().nest("/api/payment", PaymentApiDoc::openapi()));
    openapi.merge(OpenApi::default().nest("/api/admin/payment", PaymentApiDoc::openapi()));

    openapi.merge(OpenApi::default().nest("/api/wx", WxApiDoc::openapi()));
    openapi.merge(OpenApi::default().nest("/api/admin/wx", WxApiDoc::openapi()));

    openapi.merge(OpenApi::default().nest("/api/admin/system", SystemApiDoc::openapi()));

    openapi.merge(OpenApi::default().nest("/api/account", AccountApiDoc::openapi()));
    openapi.merge(OpenApi::default().nest("/api/admin/account", AccountApiDoc::openapi()));

    openapi.merge(OpenApi::default().nest("/api/order", OrderApiDoc::openapi()));
    openapi.merge(OpenApi::default().nest("/api/admin/orders", OrderApiDoc::openapi()));

    normalize_paths(&mut openapi);
    openapi
}

pub fn create_openapi_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .merge(SwaggerUi::new("/api/docs").url("/api/openapi.json", build_openapi_document()))
        .merge(SwaggerUi::new("/apid/docs").url("/apid/openapi.json", build_openapi_document()))
}

pub async fn openapi_handler() -> Json<OpenApi> {
    Json(build_openapi_document())
}

fn normalize_paths(openapi: &mut OpenApi) {
    let mut normalized_paths: utoipa::openapi::path::PathsMap<String, PathItem> =
        utoipa::openapi::path::PathsMap::new();

    for (path, item) in std::mem::take(&mut openapi.paths.paths) {
        let normalized_path = if path.len() > 1 {
            path.trim_end_matches('/').to_string()
        } else {
            path
        };

        if let Some(existing) = normalized_paths.get_mut(&normalized_path) {
            existing.merge_operations(item);
        } else {
            normalized_paths.insert(normalized_path, item);
        }
    }

    openapi.paths.paths = normalized_paths;
}

fn filter_user_app_paths(mut openapi: OpenApi) -> OpenApi {
    remove_path(&mut openapi, "/api/user/search");
    remove_path(&mut openapi, "/api/user/{user_id}");
    remove_path_prefix(&mut openapi, "/api/user/players");
    openapi
}

fn filter_team_app_paths(mut openapi: OpenApi) -> OpenApi {
    remove_path(&mut openapi, "/api/teams/admin");
    remove_path(&mut openapi, "/api/teams/admin-list");
    remove_path(&mut openapi, "/api/teams/{id}/admin-detail");
    remove_path(&mut openapi, "/api/teams/{id}/admin-managers");
    remove_path_prefix(&mut openapi, "/api/teams/{id}/admin-managers/");
    openapi
}

fn filter_activity_app_paths(mut openapi: OpenApi) -> OpenApi {
    remove_path(&mut openapi, "/api/activity/location-search");
    remove_path(&mut openapi, "/api/activity/location-resolve");
    remove_path(&mut openapi, "/api/activity/batch");
    remove_operation(&mut openapi, "/api/activity/{activity_id}", |item| {
        item.patch = None
    });
    remove_path(&mut openapi, "/api/activity/{activity_id}/status");
    remove_path(&mut openapi, "/api/activity/{activity_id}/backfill");
    remove_path_prefix(&mut openapi, "/api/activity/{activity_id}/user/");
    remove_path(&mut openapi, "/api/activity/{activity_id}/registrations");
    remove_path(
        &mut openapi,
        "/api/activity/{activity_id}/registrations/batch",
    );
    openapi
}

fn remove_path(openapi: &mut OpenApi, path: &str) {
    openapi.paths.paths.remove(path);
}

fn remove_path_prefix(openapi: &mut OpenApi, prefix: &str) {
    openapi
        .paths
        .paths
        .retain(|path, _| !path.starts_with(prefix));
}

fn remove_operation<F>(openapi: &mut OpenApi, path: &str, update: F)
where
    F: FnOnce(&mut PathItem),
{
    if let Some(item) = openapi.paths.paths.get_mut(path) {
        update(item);
        if is_empty_path_item(item) {
            openapi.paths.paths.remove(path);
        }
    }
}

fn is_empty_path_item(item: &PathItem) -> bool {
    item.get.is_none()
        && item.put.is_none()
        && item.post.is_none()
        && item.delete.is_none()
        && item.options.is_none()
        && item.head.is_none()
        && item.patch.is_none()
        && item.trace.is_none()
}
