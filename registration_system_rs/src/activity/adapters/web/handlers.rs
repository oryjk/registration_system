use crate::activity::adapters::web::dto::{
    ActivityCheckInRecordDto, ActivityDto, ActivityListPageDto, AdminRegisterRequest,
    BackfillActivityDto, BatchDeleteActivitiesRequest, BatchUpdateStandRequest,
    CreateActivityRequest, DeleteRegistrationResultDto, ListActivitiesQuery,
    ListRegistrationsQuery, LocationSearchResultDto, OngoingActivityDto, RegistrationDto,
    RegistrationListPageDto, ResolveLocationQuery, SearchLocationsQuery,
    SubmitActivityCheckInRequest, TeamRegistrationCancelRequest, TeamRegistrationRequest,
    UpdateActivityRequest, UpdateMyStandRequest, UpdateStatusRequest,
    UpdateTeamCheckInConfigRequest,
};
use crate::activity::application::{
    ActivityApplicationError, ActivityPrincipal, CreateActivityCheckInConfigCommand,
    CreateActivityCommand, SubmitActivityCheckInCommand, UpdateActivityCommand,
    UpdateMyStandCommand, UpdateTeamCheckInConfigCommand,
};
use crate::bootstrap::app::AppState;
use crate::shared::api_response::ApiResponse;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::shared::http_error::HttpError;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;

fn activity_principal(actor: ActorContext) -> ActivityPrincipal {
    match actor.actor_kind {
        ActorKind::Admin => ActivityPrincipal::admin(actor.id, actor.is_super_admin),
        ActorKind::User => ActivityPrincipal::user(actor.id),
    }
}

fn activity_http_error(error: ActivityApplicationError) -> HttpError {
    let app_error = match error {
        ActivityApplicationError::Unauthorized => AppError::Unauthorized,
        ActivityApplicationError::Forbidden => AppError::Forbidden,
        ActivityApplicationError::NotFound(message) => AppError::NotFound(message),
        ActivityApplicationError::Conflict(message) => AppError::Conflict(message),
        ActivityApplicationError::Validation(message) => AppError::Validation(message),
        ActivityApplicationError::Internal(message) => AppError::Internal(message),
    };
    HttpError(app_error)
}

pub async fn create_activity_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateActivityRequest>,
) -> Result<Json<ApiResponse<ActivityDto>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    let activity = state
        .services
        .activity_service
        .create_activity(
            &principal,
            CreateActivityCommand {
                cover: payload.cover,
                start_time: payload.start_time,
                end_time: payload.end_time,
                holding_date: payload.holding_date,
                location: payload.location,
                location_latitude: payload.location_latitude,
                location_longitude: payload.location_longitude,
                name: payload.name,
                opposing: payload.opposing,
                description: payload.description,
                home_team_id: payload.home_team_id,
                away_team_id: payload.away_team_id,
                color: payload.color,
                opposing_color: payload.opposing_color,
                players_per_team: payload.players_per_team,
                team_checkin_configs: payload
                    .team_checkin_configs
                    .unwrap_or_default()
                    .into_iter()
                    .map(|item| CreateActivityCheckInConfigCommand {
                        team_id: item.team_id,
                        enabled: item.enabled,
                        radius_meters: item.radius_meters,
                        open_minutes_before: item.open_minutes_before,
                        close_minutes_after: item.close_minutes_after,
                    })
                    .collect(),
            },
        )
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::with_message(
        "活动创建成功",
        ActivityDto::from(activity),
    )))
}

pub async fn list_activities_handler(
    State(state): State<AppState>,
    Query(query): Query<ListActivitiesQuery>,
) -> Result<Json<ApiResponse<ActivityListPageDto>>, HttpError> {
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).clamp(1, 100);
    let status_filter = match query.status {
        None | Some(-1) => None,
        Some(s) if (0..=3).contains(&s) => Some(s),
        _ => None,
    };
    let page_data = state
        .services
        .activity_service
        .list_activities(status_filter, page, page_size)
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::success(ActivityListPageDto::from(
        page_data,
    ))))
}

pub async fn search_locations_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<SearchLocationsQuery>,
) -> Result<Json<ApiResponse<Vec<LocationSearchResultDto>>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    let locations = state
        .services
        .activity_service
        .search_locations(&principal, &query.keyword, query.limit.unwrap_or(8))
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::success(
        locations
            .into_iter()
            .map(LocationSearchResultDto::from)
            .collect(),
    )))
}

pub async fn resolve_location_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ResolveLocationQuery>,
) -> Result<Json<ApiResponse<LocationSearchResultDto>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    let location = state
        .services
        .activity_service
        .resolve_location(&principal, query.latitude, query.longitude)
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::success(LocationSearchResultDto::from(
        location,
    ))))
}

pub async fn get_activity_handler(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
) -> Result<Json<ApiResponse<ActivityDto>>, HttpError> {
    let activity = state
        .services
        .activity_service
        .get_activity(&activity_id)
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::success(ActivityDto::from(activity))))
}

pub async fn update_status_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<UpdateStatusRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    state
        .services
        .activity_service
        .update_status(&principal, &activity_id, payload.status)
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::message("活动状态更新成功")))
}

pub async fn update_my_stand_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<UpdateMyStandRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    state
        .services
        .activity_service
        .update_my_stand(
            &principal,
            &activity_id,
            UpdateMyStandCommand {
                stand: payload.stand,
                registration_count: payload.registration_count,
            },
        )
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::message("报名状态更新成功")))
}

pub async fn list_activity_users_handler(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
) -> Result<Json<ApiResponse<Vec<RegistrationDto>>>, HttpError> {
    let registrations = state
        .services
        .activity_service
        .list_activity_users(&activity_id)
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::success(
        registrations
            .into_iter()
            .map(RegistrationDto::from)
            .collect(),
    )))
}

pub async fn update_team_checkin_config_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<UpdateTeamCheckInConfigRequest>,
) -> Result<Json<ApiResponse<ActivityDto>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    state
        .services
        .activity_service
        .update_team_checkin_config(
            &principal,
            &activity_id,
            UpdateTeamCheckInConfigCommand {
                team_id: payload.team_id,
                enabled: payload.enabled,
                radius_meters: payload.radius_meters,
                open_minutes_before: payload.open_minutes_before,
                close_minutes_after: payload.close_minutes_after,
            },
        )
        .await
        .map_err(activity_http_error)?;

    let activity = state
        .services
        .activity_service
        .get_activity(&activity_id)
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::with_message(
        "签到配置更新成功",
        ActivityDto::from(activity),
    )))
}

pub async fn submit_activity_checkin_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<SubmitActivityCheckInRequest>,
) -> Result<Json<ApiResponse<ActivityCheckInRecordDto>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    let record = state
        .services
        .activity_service
        .submit_check_in(
            &principal,
            &activity_id,
            SubmitActivityCheckInCommand {
                team_id: payload.team_id,
                latitude: payload.latitude,
                longitude: payload.longitude,
                current_time: None,
            },
        )
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::with_message(
        "签到成功",
        ActivityCheckInRecordDto::from(record),
    )))
}

pub async fn delete_activities_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BatchDeleteActivitiesRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    state
        .services
        .activity_service
        .delete_activities(&principal, &payload.ids)
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::message("活动删除成功")))
}

pub async fn check_ongoing_handler(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<OngoingActivityDto>>, HttpError> {
    let result = state
        .services
        .activity_service
        .check_ongoing_activities()
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::success(OngoingActivityDto {
        has_ongoing: result.has_ongoing,
        activity: result.activity.map(ActivityDto::from),
    })))
}

pub async fn update_user_stand_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((activity_id, user_id)): Path<(String, i64)>,
    Json(payload): Json<UpdateMyStandRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    state
        .services
        .activity_service
        .update_user_stand(
            &principal,
            &activity_id,
            user_id,
            UpdateMyStandCommand {
                stand: payload.stand,
                registration_count: payload.registration_count,
            },
        )
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::message("报名状态更新成功")))
}

pub async fn delete_user_registration_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((activity_id, user_id)): Path<(String, i64)>,
) -> Result<Json<ApiResponse<DeleteRegistrationResultDto>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    let deleted_rows = state
        .services
        .activity_service
        .delete_user_registration(&principal, &activity_id, user_id)
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::with_message(
        "报名记录删除成功",
        DeleteRegistrationResultDto { deleted_rows },
    )))
}

pub async fn update_activity_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<UpdateActivityRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    state
        .services
        .activity_service
        .update_activity(
            &principal,
            &activity_id,
            UpdateActivityCommand {
                cover: payload.cover,
                start_time: payload.start_time,
                end_time: payload.end_time,
                holding_date: payload.holding_date,
                location: payload.location,
                location_latitude: payload.location_latitude,
                location_longitude: payload.location_longitude,
                name: payload.name,
                opposing: payload.opposing,
                description: payload.description,
                home_team_id: payload.home_team_id,
                away_team_id: payload.away_team_id,
                color: payload.color,
                opposing_color: payload.opposing_color,
                players_per_team: payload.players_per_team,
            },
        )
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::message("活动更新成功")))
}

/// 管理后台：含球员信息的报名列表（分页）
pub async fn list_registrations_with_info_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Query(query): Query<ListRegistrationsQuery>,
) -> Result<Json<ApiResponse<RegistrationListPageDto>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).clamp(1, 100);
    let stand_filter = match query.stand {
        None | Some(-1) => None,
        Some(s) if (0..=3).contains(&s) => Some(s),
        _ => None,
    };
    let page_data = state
        .services
        .activity_service
        .list_registrations_with_info(&principal, &activity_id, stand_filter, page, page_size)
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::success(RegistrationListPageDto::from(
        page_data,
    ))))
}

/// 管理员手动为球员报名 / 更新报名状态
pub async fn admin_register_user_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<AdminRegisterRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    state
        .services
        .activity_service
        .admin_register_user(
            &principal,
            &activity_id,
            payload.user_id,
            payload.stand,
            payload.registration_count.unwrap_or(1),
        )
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::message("报名操作成功")))
}

/// 管理员批量修改报名状态
pub async fn batch_update_stand_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<BatchUpdateStandRequest>,
) -> Result<Json<ApiResponse<u64>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    let updated_count = state
        .services
        .activity_service
        .batch_update_user_stand(
            &principal,
            &activity_id,
            &payload.user_ids,
            payload.stand,
            payload
                .registration_count
                .unwrap_or(if payload.stand == 1 { 1 } else { 0 }),
        )
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::with_message(
        "批量更新报名状态成功",
        updated_count,
    )))
}

pub async fn update_team_registration_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<TeamRegistrationRequest>,
) -> Result<Json<ApiResponse<ActivityDto>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    let activity = state
        .services
        .activity_service
        .update_team_registration(
            &principal,
            &activity_id,
            &payload.team_id,
            payload.registration_count,
        )
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::with_message(
        "球队报名提交成功",
        ActivityDto::from(activity),
    )))
}

pub async fn cancel_team_registration_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<TeamRegistrationCancelRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    state
        .services
        .activity_service
        .cancel_team_registration(&principal, &activity_id, &payload.team_id)
        .await
        .map_err(activity_http_error)?;

    Ok(Json(ApiResponse::message("球队报名已取消")))
}

pub async fn backfill_activity_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
) -> Result<Json<ApiResponse<BackfillActivityDto>>, HttpError> {
    let principal = activity_principal(state.actor(&headers)?);
    let backfilled_count = state
        .services
        .activity_service
        .backfill_activity(&principal, &activity_id)
        .await
        .map_err(activity_http_error)?;
    Ok(Json(ApiResponse::with_message(
        "活动报名回填成功",
        BackfillActivityDto {
            activity_id,
            backfilled_count,
        },
    )))
}
