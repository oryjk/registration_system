use crate::bootstrap::app::AppState;
use crate::shared::api_response::ApiResponse;
use crate::shared::auth::ActorKind;
use crate::shared::error::AppError;
use crate::shared::http_error::HttpError;
use crate::shared::upload::{detect_image_extension, save_minio_bytes};
use crate::user::adapters::web::dto::{
    AdminChangePlayerPasswordRequest, AdminCreatePlayerRequest, AdminCreateRoleUserRequest,
    AdminUpdatePlayerRequest, BindPhoneNumberRequest, PlayerDto, PlayerListDto, TokenVerifyDto,
    UpdateProfileRequest, UserActivityRecordDto, UserAttendanceRankingDto, UserAttendanceRecordDto,
    UserAvatarUploadResponse, UserDto, UserLoginRequest, UserLoginResponse,
    UserPasswordLoginRequest,
};
use crate::user::domain::PlayerAdminListQuery;
use axum::Json;
use axum::extract::{Multipart, Path, Query, State};
use axum::http::HeaderMap;
use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

#[derive(Debug, Deserialize, IntoParams)]
pub struct UserSearchQuery {
    pub keyword: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct DateRangeQuery {
    #[serde(rename = "startDate")]
    pub start_date: Option<String>,
    #[serde(rename = "endDate")]
    pub end_date: Option<String>,
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<UserLoginRequest>,
) -> Result<Json<ApiResponse<UserLoginResponse>>, HttpError> {
    let result = state
        .services
        .user_service
        .login(
            &payload.open_id,
            payload.union_id,
            payload.username,
            payload.nickname,
            payload.avatar_url,
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "用户登录成功",
        UserLoginResponse {
            access_token: result.access_token,
            token_type: "Bearer",
            user: UserDto::from(result.user),
        },
    )))
}

pub async fn password_login_handler(
    State(state): State<AppState>,
    Json(payload): Json<UserPasswordLoginRequest>,
) -> Result<Json<ApiResponse<UserLoginResponse>>, HttpError> {
    let result = state
        .services
        .user_service
        .login_with_password(&payload.username, &payload.password)
        .await?;

    Ok(Json(ApiResponse::with_message(
        "用户登录成功",
        UserLoginResponse {
            access_token: result.access_token,
            token_type: "Bearer",
            user: UserDto::from(result.user),
        },
    )))
}

pub async fn current_user_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let user = state.services.user_service.get_current_user(&actor).await?;

    Ok(Json(ApiResponse::success(UserDto::from(user))))
}

pub async fn list_users_handler(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<UserDto>>>, HttpError> {
    let users = state.services.user_service.list_users().await?;

    Ok(Json(ApiResponse::success(
        users.into_iter().map(UserDto::from).collect(),
    )))
}

pub async fn verify_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<TokenVerifyDto>>, HttpError> {
    let claims = state.claims(&headers)?;
    Ok(Json(ApiResponse::with_message(
        "Token 有效",
        TokenVerifyDto {
            user_id: claims.sub,
        },
    )))
}

pub async fn get_user_info_by_id_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    if actor.actor_kind != crate::shared::auth::ActorKind::Admin && actor.id != user_id {
        return Err(AppError::Forbidden.into());
    }
    let user = state.services.user_service.get_user_info(user_id).await?;
    Ok(Json(ApiResponse::success(UserDto::from(user))))
}

pub async fn list_user_infos_handler(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<UserDto>>>, HttpError> {
    list_users_handler(State(state)).await
}

pub async fn search_users_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<UserSearchQuery>,
) -> Result<Json<ApiResponse<Vec<UserDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let users = state
        .services
        .user_service
        .search_users(
            &actor,
            query.keyword.as_deref().unwrap_or(""),
            query.limit.unwrap_or(20),
        )
        .await?;
    Ok(Json(ApiResponse::success(
        users.into_iter().map(UserDto::from).collect(),
    )))
}

pub async fn update_profile_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let user = state
        .services
        .user_service
        .update_profile(
            &actor,
            payload.nickname.as_deref(),
            payload.real_name.as_deref(),
            payload.avatar_url.as_deref(),
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "更新用户资料成功",
        UserDto::from(user),
    )))
}

pub async fn upload_avatar_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<UserAvatarUploadResponse>>, HttpError> {
    let actor = state.actor(&headers)?;
    if actor.actor_kind != ActorKind::User {
        return Err(AppError::Forbidden.into());
    }

    let mut avatar_bytes = None;
    let mut content_type = None;
    let mut file_name = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|error| AppError::Validation(format!("读取上传内容失败: {error}")))?
    {
        if field.name() != Some("file") || avatar_bytes.is_some() {
            continue;
        }

        content_type = field.content_type().map(str::to_string);
        file_name = field.file_name().map(str::to_string);
        let bytes = field
            .bytes()
            .await
            .map_err(|error| AppError::Validation(format!("读取头像文件失败: {error}")))?;
        avatar_bytes = Some(bytes);
        break;
    }

    let avatar_bytes =
        avatar_bytes.ok_or_else(|| AppError::Validation("请上传头像文件".to_string()))?;
    if avatar_bytes.is_empty() {
        return Err(AppError::Validation("头像文件不能为空".to_string()).into());
    }
    if avatar_bytes.len() > 5 * 1024 * 1024 {
        return Err(AppError::Validation("头像文件不能超过 5MB".to_string()).into());
    }

    let extension = detect_image_extension(content_type.as_deref(), file_name.as_deref())
        .ok_or_else(|| AppError::Validation("头像仅支持 jpg/png/webp".to_string()))?;

    let file_name = format!("user-{}-{}.{}", actor.id, Uuid::new_v4(), extension);
    let object_key = format!("avatars/{file_name}");
    let avatar_url = save_minio_bytes(
        &state.config,
        &object_key,
        &avatar_bytes,
        content_type.as_deref(),
    )
    .await?;
    let user = state
        .services
        .user_service
        .update_profile(&actor, None, None, Some(&avatar_url))
        .await?;

    Ok(Json(ApiResponse::with_message(
        "头像上传成功",
        UserAvatarUploadResponse {
            avatar_url: user.avatar_url,
        },
    )))
}

pub async fn update_user_by_id_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let user = state
        .services
        .user_service
        .update_user_by_target(
            &actor,
            user_id,
            crate::user::application::UpdateUserCommand {
                nickname: payload.nickname.as_deref(),
                real_name: payload.real_name.as_deref(),
                avatar_url: payload.avatar_url.as_deref(),
                is_manager: payload.is_manager,
                is_venue: payload.is_venue,
                status: payload.status,
                leave_start_time: payload.leave_start_time,
                leave_end_time: payload.leave_end_time,
            },
        )
        .await?;
    Ok(Json(ApiResponse::with_message(
        "更新用户信息成功",
        UserDto::from(user),
    )))
}

pub async fn bind_phone_number_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BindPhoneNumberRequest>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let user = state
        .services
        .user_service
        .bind_current_user_phone(&actor, &payload.phone_number)
        .await?;

    Ok(Json(ApiResponse::with_message(
        "手机号绑定成功",
        UserDto::from(user),
    )))
}

pub async fn delete_user_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let actor = state.actor(&headers)?;
    state
        .services
        .user_service
        .delete_user(&actor, user_id)
        .await?;
    Ok(Json(ApiResponse::message("删除用户成功")))
}

pub async fn get_my_activities_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<Vec<UserActivityRecordDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .user_service
        .get_user_activities(&actor, actor.id)
        .await?;
    Ok(Json(ApiResponse::success(
        items.into_iter().map(UserActivityRecordDto::from).collect(),
    )))
}

pub async fn get_user_activities_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<Vec<UserActivityRecordDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .user_service
        .get_user_activities(&actor, user_id)
        .await?;
    Ok(Json(ApiResponse::success(
        items.into_iter().map(UserActivityRecordDto::from).collect(),
    )))
}

pub async fn get_my_attendance_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<ApiResponse<Vec<UserAttendanceRecordDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .user_service
        .get_user_attendance_records(
            &actor,
            actor.id,
            query.start_date.as_deref(),
            query.end_date.as_deref(),
        )
        .await?;
    Ok(Json(ApiResponse::success(
        items
            .into_iter()
            .map(UserAttendanceRecordDto::from)
            .collect(),
    )))
}

pub async fn get_user_attendance_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<ApiResponse<Vec<UserAttendanceRecordDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .user_service
        .get_user_attendance_records(
            &actor,
            user_id,
            query.start_date.as_deref(),
            query.end_date.as_deref(),
        )
        .await?;
    Ok(Json(ApiResponse::success(
        items
            .into_iter()
            .map(UserAttendanceRecordDto::from)
            .collect(),
    )))
}

pub async fn attendance_ranking_handler(
    State(state): State<AppState>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<ApiResponse<Vec<UserAttendanceRankingDto>>>, HttpError> {
    let items = state
        .services
        .user_service
        .get_user_attendance_ranking(query.start_date.as_deref(), query.end_date.as_deref())
        .await?;
    Ok(Json(ApiResponse::success(
        items
            .into_iter()
            .map(UserAttendanceRankingDto::from)
            .collect(),
    )))
}

pub async fn attendance_ranking_for_user_handler(
    State(state): State<AppState>,
    Path(user_id): Path<i64>,
    Query(query): Query<DateRangeQuery>,
) -> Result<Json<ApiResponse<Option<UserAttendanceRankingDto>>>, HttpError> {
    let item = state
        .services
        .user_service
        .get_user_attendance_ranking_for_user(
            user_id,
            query.start_date.as_deref(),
            query.end_date.as_deref(),
        )
        .await?;
    Ok(Json(ApiResponse::success(
        item.map(UserAttendanceRankingDto::from),
    )))
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct PlayerListQuery {
    pub keyword: Option<String>,
    pub status: Option<i8>,
    pub has_team: Option<bool>,
    pub role: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct FreezePlayerRequest {
    pub freeze_start_time: chrono::NaiveDateTime,
    pub freeze_end_time: Option<chrono::NaiveDateTime>,
}

#[allow(dead_code)]
#[derive(Debug, ToSchema)]
pub struct UploadAvatarRequest {
    #[schema(value_type = String, format = Binary)]
    pub file: String,
}

/// 管理后台：创建球员
pub async fn admin_create_player_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AdminCreatePlayerRequest>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let user = state
        .services
        .user_service
        .admin_create_player(
            &actor,
            payload.real_name,
            payload.nickname,
            payload.phone_number,
            payload.is_venue,
        )
        .await?;
    Ok(Json(ApiResponse::with_message(
        "球员创建成功",
        UserDto::from(user),
    )))
}

/// 管理后台：超级管理员创建队长/场馆账号
pub async fn admin_create_role_user_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AdminCreateRoleUserRequest>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let user = state
        .services
        .user_service
        .create_role_user(&actor, payload.into())
        .await?;
    Ok(Json(ApiResponse::with_message(
        "角色用户创建成功",
        UserDto::from(user),
    )))
}

/// 管理后台：获取单个球员详情（含球队 + 冻结信息）
pub async fn get_player_detail_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<PlayerDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let player = state
        .services
        .user_service
        .get_player_detail(&actor, user_id)
        .await?;
    Ok(Json(ApiResponse::success(PlayerDto::from(player))))
}

/// 管理后台：更新球员基本信息（昵称/真实姓名/手机号）
pub async fn admin_update_player_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
    Json(payload): Json<AdminUpdatePlayerRequest>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    // 只允许管理员操作
    if actor.actor_kind != crate::shared::auth::ActorKind::Admin {
        return Err(AppError::Forbidden.into());
    }
    let user = state
        .services
        .user_service
        .update_user_by_target(
            &actor,
            user_id,
            crate::user::application::UpdateUserCommand {
                nickname: payload.nickname.as_deref(),
                real_name: payload.real_name.as_deref(),
                is_venue: payload.is_venue,
                status: payload.status,
                leave_start_time: payload.freeze_start_time.map(Some),
                leave_end_time: payload.freeze_end_time,
                ..Default::default()
            },
        )
        .await?;
    // 若传了手机号，再单独更新
    if let Some(ref phone) = payload.phone_number {
        state
            .services
            .user_service
            .update_user_phone(&actor, user_id, phone)
            .await?;
    }
    Ok(Json(ApiResponse::with_message(
        "球员信息已更新",
        UserDto::from(user),
    )))
}

/// 管理后台：超级管理员修改队长/场馆账号密码
pub async fn change_player_password_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
    Json(payload): Json<AdminChangePlayerPasswordRequest>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let user = state
        .services
        .user_service
        .change_role_user_password(&actor, user_id, payload.password)
        .await?;
    Ok(Json(ApiResponse::with_message(
        "密码已修改",
        UserDto::from(user),
    )))
}

/// 管理后台：冻结球员
pub async fn freeze_player_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
    Json(payload): Json<FreezePlayerRequest>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let user = state
        .services
        .user_service
        .freeze_player(
            &actor,
            user_id,
            payload.freeze_start_time,
            payload.freeze_end_time,
        )
        .await?;
    Ok(Json(ApiResponse::with_message(
        "球员已冻结",
        UserDto::from(user),
    )))
}

/// 管理后台：解冻球员
pub async fn unfreeze_player_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<UserDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let user = state
        .services
        .user_service
        .unfreeze_player(&actor, user_id)
        .await?;
    Ok(Json(ApiResponse::with_message(
        "球员已解冻",
        UserDto::from(user),
    )))
}

/// 管理后台：移除场馆身份或删除独立场馆账号
pub async fn remove_venue_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<Option<UserDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let result = state.services.user_service.remove_venue(&actor, user_id).await?;
    Ok(Json(ApiResponse::with_message(
        "场馆已删除",
        result.map(UserDto::from),
    )))
}

/// 管理后台：球员列表（分页 + 搜索 + 过滤）
pub async fn list_players_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<PlayerListQuery>,
) -> Result<Json<ApiResponse<PlayerListDto>>, HttpError> {
    let actor = state.actor(&headers)?;

    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).clamp(1, 100);

    let result = state
        .services
        .user_service
        .list_players(
            &actor,
            PlayerAdminListQuery {
                keyword: query.keyword.as_deref(),
                status: query.status,
                has_team: query.has_team,
                role: query.role.as_deref(),
                page,
                page_size,
                sort_by: query.sort_by.as_deref(),
                sort_order: query.sort_order.as_deref(),
                admin_scope: None,
            },
        )
        .await?;

    Ok(Json(ApiResponse::success(PlayerListDto::from_result(
        result, page, page_size,
    ))))
}
