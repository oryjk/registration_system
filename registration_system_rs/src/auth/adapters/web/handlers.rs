use crate::auth::adapters::web::dto::{
    AdminLoginApiResponse, AdminLoginRequest, AdminLoginResponse, AdminRegisterRequest,
    AdminUserApiResponse, AdminUserDto, AdminUserListApiResponse, EmptyApiResponse,
    ErrorApiResponse, UpdateAdminStatusRequest, VerifyTokenApiResponse, VerifyTokenResponse,
};
use crate::bootstrap::app::AppState;
use crate::shared::api_response::ApiResponse;
use crate::shared::http_error::HttpError;
use axum::Json;
use axum::extract::{Path, State};
use axum::http::HeaderMap;

#[utoipa::path(
    post,
    path = "/auth/login",
    tag = "Auth",
    request_body = AdminLoginRequest,
    responses(
        (status = 200, description = "管理员登录成功", body = AdminLoginApiResponse),
        (status = 401, description = "账号或密码错误", body = ErrorApiResponse),
        (status = 500, description = "服务内部错误", body = ErrorApiResponse)
    )
)]
pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<AdminLoginRequest>,
) -> Result<Json<ApiResponse<AdminLoginResponse>>, HttpError> {
    let result = state
        .services
        .auth_service
        .login(&payload.username, &payload.password)
        .await?;

    Ok(Json(ApiResponse::with_message(
        "管理员登录成功",
        AdminLoginResponse {
            access_token: result.access_token,
            token_type: "Bearer",
            admin: AdminUserDto::from(result.admin),
        },
    )))
}

#[utoipa::path(
    post,
    path = "/auth/verify",
    tag = "Auth",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "管理员 Token 有效", body = VerifyTokenApiResponse),
        (status = 401, description = "未认证", body = ErrorApiResponse),
        (status = 403, description = "无权限访问", body = ErrorApiResponse)
    )
)]
pub async fn verify_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<VerifyTokenResponse>>, HttpError> {
    let actor = state.actor(&headers)?;
    let admin = state.services.auth_service.verify_admin(&actor).await?;

    Ok(Json(ApiResponse::with_message(
        "Token 有效",
        VerifyTokenResponse {
            admin_id: admin.id,
            admin: AdminUserDto::from(admin),
        },
    )))
}

#[utoipa::path(
    post,
    path = "/auth/register",
    tag = "Auth",
    security(
        ("bearer_auth" = [])
    ),
    request_body = AdminRegisterRequest,
    responses(
        (status = 200, description = "管理员创建成功", body = AdminUserApiResponse),
        (status = 401, description = "未认证", body = ErrorApiResponse),
        (status = 403, description = "无权限访问", body = ErrorApiResponse),
        (status = 409, description = "管理员已存在", body = ErrorApiResponse),
        (status = 500, description = "服务内部错误", body = ErrorApiResponse)
    )
)]
pub async fn register_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AdminRegisterRequest>,
) -> Result<Json<ApiResponse<AdminUserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let admin = state
        .services
        .auth_service
        .register_admin(
            &actor,
            &payload.username,
            &payload.password,
            payload.nickname.as_deref(),
            payload.is_super_admin.unwrap_or(false),
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "管理员创建成功",
        AdminUserDto::from(admin),
    )))
}

#[utoipa::path(
    post,
    path = "/auth/logout",
    tag = "Auth",
    responses(
        (status = 200, description = "管理员退出登录", body = EmptyApiResponse)
    )
)]
pub async fn logout_handler() -> Json<ApiResponse<()>> {
    Json(ApiResponse::message("退出登录成功"))
}

#[utoipa::path(
    get,
    path = "/auth/admins",
    tag = "Auth",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "管理员列表", body = AdminUserListApiResponse),
        (status = 401, description = "未认证", body = ErrorApiResponse),
        (status = 403, description = "无权限访问", body = ErrorApiResponse)
    )
)]
pub async fn list_admins_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<Vec<AdminUserDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let admins = state.services.auth_service.list_admins(&actor).await?;

    Ok(Json(ApiResponse::success(
        admins.into_iter().map(AdminUserDto::from).collect(),
    )))
}

#[utoipa::path(
    patch,
    path = "/auth/admins/{id}/status",
    tag = "Auth",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("id" = i64, Path, description = "管理员 ID")
    ),
    request_body = UpdateAdminStatusRequest,
    responses(
        (status = 200, description = "管理员状态更新成功", body = EmptyApiResponse),
        (status = 401, description = "未认证", body = ErrorApiResponse),
        (status = 403, description = "无权限访问", body = ErrorApiResponse),
        (status = 404, description = "管理员不存在", body = ErrorApiResponse)
    )
)]
pub async fn update_admin_status_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(admin_id): Path<i64>,
    Json(payload): Json<UpdateAdminStatusRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let actor = state.actor(&headers)?;
    state
        .services
        .auth_service
        .update_admin_status(&actor, admin_id, payload.status)
        .await?;

    Ok(Json(ApiResponse::message("管理员状态更新成功")))
}

#[utoipa::path(
    delete,
    path = "/auth/admins/{id}",
    tag = "Auth",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("id" = i64, Path, description = "管理员 ID")
    ),
    responses(
        (status = 200, description = "管理员删除成功", body = EmptyApiResponse),
        (status = 401, description = "未认证", body = ErrorApiResponse),
        (status = 403, description = "无权限访问", body = ErrorApiResponse),
        (status = 404, description = "管理员不存在", body = ErrorApiResponse)
    )
)]
pub async fn delete_admin_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(admin_id): Path<i64>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let actor = state.actor(&headers)?;
    state
        .services
        .auth_service
        .delete_admin(&actor, admin_id)
        .await?;

    Ok(Json(ApiResponse::message("管理员删除成功")))
}
