#![allow(dead_code)]

use super::dto::{
    ActivityCheckInRecordDto, ActivityDto, ActivityListPageDto, ActivityStatusCountsDto,
    ActivityTeamCheckInConfigDto, AdminRegisterRequest, BackfillActivityDto,
    BatchDeleteActivitiesRequest, BatchUpdateStandRequest, CreateActivityCheckInConfigRequest,
    CreateActivityRequest, DeleteRegistrationResultDto, ListActivitiesQuery,
    ListRegistrationsQuery, LocationSearchResultDto, OngoingActivityDto, RegistrationDto,
    RegistrationListPageDto, RegistrationStandCountsDto, RegistrationWithInfoDto,
    ResolveLocationQuery, SearchLocationsQuery, SubmitActivityCheckInRequest,
    UpdateActivityRequest, UpdateMyStandRequest, UpdateStatusRequest,
    UpdateTeamCheckInConfigRequest,
};
use crate::shared::api_response::{ApiResponse, EmptyData};
use crate::shared::openapi::BearerSecurityAddon;
use utoipa::OpenApi;

#[utoipa::path(
    post,
    path = "/",
    tag = "Activity",
    security(("bearer_auth" = [])),
    request_body = CreateActivityRequest,
    responses(
        (status = 200, description = "创建活动成功", body = ApiResponse<ActivityDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn create_activity_doc() {}

#[utoipa::path(
    post,
    path = "/create",
    tag = "Activity",
    security(("bearer_auth" = [])),
    request_body = CreateActivityRequest,
    responses(
        (status = 200, description = "创建活动成功", body = ApiResponse<ActivityDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn create_activity_alias_doc() {}

#[utoipa::path(
    get,
    path = "/",
    tag = "Activity",
    params(ListActivitiesQuery),
    responses(
        (status = 200, description = "查询活动列表成功", body = ApiResponse<ActivityListPageDto>)
    )
)]
fn list_activities_doc() {}

#[utoipa::path(
    get,
    path = "/infos",
    tag = "Activity",
    params(ListActivitiesQuery),
    responses(
        (status = 200, description = "查询活动列表成功", body = ApiResponse<ActivityListPageDto>)
    )
)]
fn list_activities_alias_doc() {}

#[utoipa::path(
    get,
    path = "/check-ongoing",
    tag = "Activity",
    responses(
        (status = 200, description = "检查进行中活动成功", body = ApiResponse<OngoingActivityDto>)
    )
)]
fn check_ongoing_doc() {}

#[utoipa::path(
    patch,
    path = "/{activity_id}/my-stand",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    request_body = UpdateMyStandRequest,
    responses(
        (status = 200, description = "更新我的报名状态成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_my_stand_doc() {}

#[utoipa::path(
    patch,
    path = "/{activity_id}/check-in-config",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    request_body = UpdateTeamCheckInConfigRequest,
    responses(
        (status = 200, description = "更新签到配置成功", body = ApiResponse<ActivityDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_team_checkin_config_doc() {}

#[utoipa::path(
    post,
    path = "/{activity_id}/check-in",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    request_body = SubmitActivityCheckInRequest,
    responses(
        (status = 200, description = "提交签到成功", body = ApiResponse<ActivityCheckInRecordDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn submit_activity_checkin_doc() {}

#[utoipa::path(
    get,
    path = "/{activity_id}/users",
    tag = "Activity",
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    responses(
        (status = 200, description = "查询活动报名用户成功", body = ApiResponse<Vec<RegistrationDto>>)
    )
)]
fn list_activity_users_doc() {}

#[utoipa::path(
    get,
    path = "/{activity_id}",
    tag = "Activity",
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    responses(
        (status = 200, description = "查询活动详情成功", body = ApiResponse<ActivityDto>)
    )
)]
fn get_activity_doc() {}

#[utoipa::path(
    get,
    path = "/location-search",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(SearchLocationsQuery),
    responses(
        (status = 200, description = "搜索活动地点成功", body = ApiResponse<Vec<LocationSearchResultDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn search_locations_doc() {}

#[utoipa::path(
    get,
    path = "/location-resolve",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(ResolveLocationQuery),
    responses(
        (status = 200, description = "解析活动地点成功", body = ApiResponse<LocationSearchResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn resolve_location_doc() {}

#[utoipa::path(
    delete,
    path = "/batch",
    tag = "Activity",
    security(("bearer_auth" = [])),
    request_body = BatchDeleteActivitiesRequest,
    responses(
        (status = 200, description = "批量删除活动成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn delete_activities_doc() {}

#[utoipa::path(
    patch,
    path = "/{activity_id}/user/{user_id}/stand",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID"),
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    request_body = UpdateMyStandRequest,
    responses(
        (status = 200, description = "更新指定用户报名状态成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_user_stand_doc() {}

#[utoipa::path(
    delete,
    path = "/{activity_id}/user/{user_id}/registration",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID"),
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "删除报名记录成功", body = ApiResponse<DeleteRegistrationResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn delete_user_registration_doc() {}

#[utoipa::path(
    patch,
    path = "/{activity_id}/status",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    request_body = UpdateStatusRequest,
    responses(
        (status = 200, description = "更新活动状态成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_status_doc() {}

#[utoipa::path(
    post,
    path = "/{activity_id}/backfill",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    responses(
        (status = 200, description = "回填活动报名成功", body = ApiResponse<BackfillActivityDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn backfill_activity_doc() {}

#[utoipa::path(
    patch,
    path = "/{activity_id}",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    request_body = UpdateActivityRequest,
    responses(
        (status = 200, description = "更新活动成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_activity_doc() {}

#[utoipa::path(
    get,
    path = "/{activity_id}/registrations",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ListRegistrationsQuery,
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    responses(
        (status = 200, description = "查询报名记录成功", body = ApiResponse<RegistrationListPageDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn list_registrations_with_info_doc() {}

#[utoipa::path(
    post,
    path = "/{activity_id}/registrations",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    request_body = AdminRegisterRequest,
    responses(
        (status = 200, description = "管理员报名成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn admin_register_user_doc() {}

#[utoipa::path(
    patch,
    path = "/{activity_id}/registrations/batch",
    tag = "Activity",
    security(("bearer_auth" = [])),
    params(
        ("activity_id" = String, Path, description = "活动 ID")
    ),
    request_body = BatchUpdateStandRequest,
    responses(
        (status = 200, description = "批量更新报名状态成功", body = ApiResponse<u64>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn batch_update_stand_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        create_activity_doc,
        create_activity_alias_doc,
        list_activities_doc,
        list_activities_alias_doc,
        check_ongoing_doc,
        update_my_stand_doc,
        update_team_checkin_config_doc,
        submit_activity_checkin_doc,
        list_activity_users_doc,
        get_activity_doc,
        search_locations_doc,
        resolve_location_doc,
        delete_activities_doc,
        update_user_stand_doc,
        delete_user_registration_doc,
        update_status_doc,
        backfill_activity_doc,
        update_activity_doc,
        list_registrations_with_info_doc,
        admin_register_user_doc,
        batch_update_stand_doc
    ),
    components(
        schemas(
            ApiResponse<ActivityDto>,
            ApiResponse<ActivityListPageDto>,
            ApiResponse<OngoingActivityDto>,
            ApiResponse<ActivityCheckInRecordDto>,
            ApiResponse<Vec<RegistrationDto>>,
            ApiResponse<Vec<LocationSearchResultDto>>,
            ApiResponse<LocationSearchResultDto>,
            ApiResponse<DeleteRegistrationResultDto>,
            ApiResponse<BackfillActivityDto>,
            ApiResponse<RegistrationListPageDto>,
            ApiResponse<u64>,
            ApiResponse<EmptyData>,
            EmptyData,
            CreateActivityRequest,
            CreateActivityCheckInConfigRequest,
            UpdateStatusRequest,
            UpdateMyStandRequest,
            UpdateTeamCheckInConfigRequest,
            SubmitActivityCheckInRequest,
            BatchDeleteActivitiesRequest,
            UpdateActivityRequest,
            ActivityDto,
            ActivityTeamCheckInConfigDto,
            ActivityStatusCountsDto,
            ActivityListPageDto,
            LocationSearchResultDto,
            RegistrationDto,
            RegistrationWithInfoDto,
            RegistrationStandCountsDto,
            RegistrationListPageDto,
            AdminRegisterRequest,
            BatchUpdateStandRequest,
            OngoingActivityDto,
            BackfillActivityDto,
            ActivityCheckInRecordDto,
            DeleteRegistrationResultDto
        )
    ),
    tags(
        (name = "Activity", description = "活动与报名管理")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct ActivityApiDoc;
