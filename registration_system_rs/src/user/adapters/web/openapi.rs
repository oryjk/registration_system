#![allow(dead_code)]

use super::dto::{
    AdminCreatePlayerRequest, AdminUpdatePlayerRequest, PlayerDto, PlayerListDto, TokenVerifyDto,
    UpdateProfileRequest, UserActivityRecordDto, UserAttendanceRankingDto, UserAttendanceRecordDto,
    UserAvatarUploadResponse, UserDto, UserLoginRequest, UserLoginResponse,
};
use super::handlers::{
    DateRangeQuery, FreezePlayerRequest, PlayerListQuery, UploadAvatarRequest, UserSearchQuery,
};
use crate::shared::api_response::{ApiResponse, EmptyData};
use crate::shared::openapi::BearerSecurityAddon;
use utoipa::OpenApi;

#[utoipa::path(
    post,
    path = "/login",
    tag = "User",
    request_body = UserLoginRequest,
    responses(
        (status = 200, description = "用户登录成功", body = ApiResponse<UserLoginResponse>)
    )
)]
fn login_doc() {}

#[utoipa::path(
    post,
    path = "/verify",
    tag = "User",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "校验用户令牌成功", body = ApiResponse<TokenVerifyDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn verify_doc() {}

#[utoipa::path(
    get,
    path = "/",
    tag = "User",
    responses(
        (status = 200, description = "查询用户列表成功", body = ApiResponse<Vec<UserDto>>)
    )
)]
fn list_users_doc() {}

#[utoipa::path(
    get,
    path = "/infos",
    tag = "User",
    responses(
        (status = 200, description = "查询用户资料列表成功", body = ApiResponse<Vec<UserDto>>)
    )
)]
fn list_user_infos_doc() {}

#[utoipa::path(
    get,
    path = "/info",
    tag = "User",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "获取当前用户资料成功", body = ApiResponse<UserDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn current_user_doc() {}

#[utoipa::path(
    patch,
    path = "/info",
    tag = "User",
    security(("bearer_auth" = [])),
    request_body = UpdateProfileRequest,
    responses(
        (status = 200, description = "更新当前用户资料成功", body = ApiResponse<UserDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_profile_doc() {}

#[utoipa::path(
    post,
    path = "/avatar",
    tag = "User",
    security(("bearer_auth" = [])),
    request_body(
        content = UploadAvatarRequest,
        content_type = "multipart/form-data",
        description = "头像文件上传"
    ),
    responses(
        (status = 200, description = "上传头像成功", body = ApiResponse<UserAvatarUploadResponse>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn upload_avatar_doc() {}

#[utoipa::path(
    get,
    path = "/info/{user_id}",
    tag = "User",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "获取指定用户资料成功", body = ApiResponse<UserDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>),
        (status = 403, description = "无权查看", body = ApiResponse<EmptyData>)
    )
)]
fn get_user_info_by_id_doc() {}

#[utoipa::path(
    get,
    path = "/activities",
    tag = "User",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "获取当前用户活动记录成功", body = ApiResponse<Vec<UserActivityRecordDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_my_activities_doc() {}

#[utoipa::path(
    get,
    path = "/activities/{user_id}",
    tag = "User",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "获取指定用户活动记录成功", body = ApiResponse<Vec<UserActivityRecordDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_user_activities_doc() {}

#[utoipa::path(
    get,
    path = "/attendance",
    tag = "User",
    security(("bearer_auth" = [])),
    params(DateRangeQuery),
    responses(
        (status = 200, description = "获取当前用户出勤记录成功", body = ApiResponse<Vec<UserAttendanceRecordDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_my_attendance_doc() {}

#[utoipa::path(
    get,
    path = "/attendance/{user_id}",
    tag = "User",
    security(("bearer_auth" = [])),
    params(
        DateRangeQuery,
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "获取指定用户出勤记录成功", body = ApiResponse<Vec<UserAttendanceRecordDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_user_attendance_doc() {}

#[utoipa::path(
    get,
    path = "/attendance-ranking",
    tag = "User",
    params(DateRangeQuery),
    responses(
        (status = 200, description = "获取出勤排名成功", body = ApiResponse<Vec<UserAttendanceRankingDto>>)
    )
)]
fn attendance_ranking_doc() {}

#[utoipa::path(
    get,
    path = "/attendance-ranking/{user_id}",
    tag = "User",
    params(
        DateRangeQuery,
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "获取指定用户出勤排名成功", body = ApiResponse<Option<UserAttendanceRankingDto>>)
    )
)]
fn attendance_ranking_for_user_doc() {}

#[utoipa::path(
    get,
    path = "/search",
    tag = "User",
    security(("bearer_auth" = [])),
    params(UserSearchQuery),
    responses(
        (status = 200, description = "搜索用户成功", body = ApiResponse<Vec<UserDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn search_users_doc() {}

#[utoipa::path(
    patch,
    path = "/{user_id}",
    tag = "User",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    request_body = UpdateProfileRequest,
    responses(
        (status = 200, description = "更新指定用户成功", body = ApiResponse<UserDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_user_by_id_doc() {}

#[utoipa::path(
    delete,
    path = "/{user_id}",
    tag = "User",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "删除指定用户成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn delete_user_doc() {}

#[utoipa::path(
    get,
    path = "/players",
    tag = "User",
    security(("bearer_auth" = [])),
    params(PlayerListQuery),
    responses(
        (status = 200, description = "查询球员列表成功", body = ApiResponse<PlayerListDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn list_players_doc() {}

#[utoipa::path(
    post,
    path = "/players",
    tag = "User",
    security(("bearer_auth" = [])),
    request_body = AdminCreatePlayerRequest,
    responses(
        (status = 200, description = "创建球员成功", body = ApiResponse<UserDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn admin_create_player_doc() {}

#[utoipa::path(
    get,
    path = "/players/{user_id}",
    tag = "User",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "球员用户 ID")
    ),
    responses(
        (status = 200, description = "获取球员详情成功", body = ApiResponse<PlayerDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_player_detail_doc() {}

#[utoipa::path(
    patch,
    path = "/players/{user_id}",
    tag = "User",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "球员用户 ID")
    ),
    request_body = AdminUpdatePlayerRequest,
    responses(
        (status = 200, description = "更新球员资料成功", body = ApiResponse<UserDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn admin_update_player_doc() {}

#[utoipa::path(
    post,
    path = "/players/{user_id}/freeze",
    tag = "User",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "球员用户 ID")
    ),
    request_body = FreezePlayerRequest,
    responses(
        (status = 200, description = "冻结球员成功", body = ApiResponse<UserDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn freeze_player_doc() {}

#[utoipa::path(
    post,
    path = "/players/{user_id}/unfreeze",
    tag = "User",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "球员用户 ID")
    ),
    responses(
        (status = 200, description = "解冻球员成功", body = ApiResponse<UserDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn unfreeze_player_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        login_doc,
        verify_doc,
        list_users_doc,
        list_user_infos_doc,
        current_user_doc,
        update_profile_doc,
        upload_avatar_doc,
        get_user_info_by_id_doc,
        get_my_activities_doc,
        get_user_activities_doc,
        get_my_attendance_doc,
        get_user_attendance_doc,
        attendance_ranking_doc,
        attendance_ranking_for_user_doc,
        search_users_doc,
        update_user_by_id_doc,
        delete_user_doc,
        list_players_doc,
        admin_create_player_doc,
        get_player_detail_doc,
        admin_update_player_doc,
        freeze_player_doc,
        unfreeze_player_doc
    ),
    components(
        schemas(
            ApiResponse<UserLoginResponse>,
            ApiResponse<TokenVerifyDto>,
            ApiResponse<UserDto>,
            ApiResponse<Vec<UserDto>>,
            ApiResponse<UserAvatarUploadResponse>,
            ApiResponse<Vec<UserActivityRecordDto>>,
            ApiResponse<Vec<UserAttendanceRecordDto>>,
            ApiResponse<Vec<UserAttendanceRankingDto>>,
            ApiResponse<Option<UserAttendanceRankingDto>>,
            ApiResponse<PlayerListDto>,
            ApiResponse<PlayerDto>,
            ApiResponse<EmptyData>,
            EmptyData,
            UserLoginRequest,
            UserLoginResponse,
            UpdateProfileRequest,
            UserDto,
            TokenVerifyDto,
            UserAvatarUploadResponse,
            UserActivityRecordDto,
            UserAttendanceRecordDto,
            UserAttendanceRankingDto,
            AdminCreatePlayerRequest,
            AdminUpdatePlayerRequest,
            PlayerDto,
            PlayerListDto,
            super::dto::PlayerTeamSummaryDto,
            FreezePlayerRequest,
            UploadAvatarRequest
        )
    ),
    tags(
        (name = "User", description = "用户登录、资料、活动与出勤")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct UserApiDoc;
