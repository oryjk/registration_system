use crate::bootstrap::app::AppState;
use crate::shared::api_response::ApiResponse;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::shared::http_error::HttpError;
use crate::shared::upload::{detect_image_extension, save_upload_bytes, team_logo_upload_dir};
use crate::team::adapters::web::dto::{
    AddTeamMemberRequest, AdminCreateTeamRequest, AssignAdminRequest, BatchRemoveMembersRequest,
    BatchUpdateMemberStatusRequest, CreateTeamRequest, JoinTeamRequest,
    SubmitActivityReviewRequest, TeamAdminInfoDto, TeamCreditOverviewDto, TeamCreditPenaltyRequest,
    TeamCreditTransactionDto, TeamDetailDto, TeamDetailForAdminDto, TeamDto,
    TeamLogoUploadResponse, TeamMembershipRechargeRequest, TeamPasswordInfoDto, TeamSummaryDto,
    UpdateTeamMemberRequest, UpdateTeamRequest,
};
use crate::team::application::{
    AddTeamMemberCommand, CreateTeamCommand, SubmitActivityReviewCommand, TeamApplicationError,
    TeamCreditPenaltyCommand, TeamMembershipRechargeCommand, TeamPrincipal, UpdateTeamCommand,
    UpdateTeamMemberCommand,
};
use axum::Json;
use axum::extract::{Multipart, Path, Query, State};
use axum::http::HeaderMap;
use serde::Deserialize;
use utoipa::IntoParams;
use uuid::Uuid;

#[derive(Debug, Deserialize, IntoParams)]
pub struct TeamListQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct TeamSearchQuery {
    pub keyword: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct TeamCreditTransactionsQuery {
    pub limit: Option<i64>,
}

fn team_principal(actor: ActorContext) -> TeamPrincipal {
    match actor.actor_kind {
        ActorKind::Admin => TeamPrincipal::admin(actor.id, actor.is_super_admin),
        ActorKind::User => TeamPrincipal::user(actor.id),
    }
}

fn team_http_error(error: TeamApplicationError) -> HttpError {
    let app_error = match error {
        TeamApplicationError::Unauthorized => AppError::Unauthorized,
        TeamApplicationError::Forbidden => AppError::Forbidden,
        TeamApplicationError::NotFound(message) => AppError::NotFound(message),
        TeamApplicationError::Conflict(message) => AppError::Conflict(message),
        TeamApplicationError::Validation(message) => AppError::Validation(message),
        TeamApplicationError::Internal(message) => AppError::Internal(message),
    };
    HttpError(app_error)
}

pub async fn create_team_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateTeamRequest>,
) -> Result<Json<ApiResponse<TeamDto>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let team = state
        .services
        .team_service
        .create_team(
            &principal,
            CreateTeamCommand {
                name: payload.name,
                description: payload.description,
                logo_url: payload.logo_url,
                join_password: payload.join_password,
            },
        )
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::with_message(
        "球队创建成功",
        TeamDto::from(team),
    )))
}

pub async fn list_teams_handler(
    State(state): State<AppState>,
    Query(query): Query<TeamListQuery>,
) -> Result<Json<ApiResponse<Vec<TeamSummaryDto>>>, HttpError> {
    let active_only = query.status.as_deref() == Some("active");
    let teams = state
        .services
        .team_service
        .list_teams(active_only)
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::success(
        teams.into_iter().map(TeamSummaryDto::from).collect(),
    )))
}

/// 管理后台列表：超级管理员看全部，普通管理员只看被分配的球队
pub async fn admin_list_teams_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<TeamListQuery>,
) -> Result<Json<ApiResponse<Vec<TeamSummaryDto>>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let active_only = query.status.as_deref() == Some("active");
    let teams = state
        .services
        .team_service
        .admin_list_teams(&principal, active_only)
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::success(
        teams.into_iter().map(TeamSummaryDto::from).collect(),
    )))
}

pub async fn search_teams_handler(
    State(state): State<AppState>,
    Query(query): Query<TeamSearchQuery>,
) -> Result<Json<ApiResponse<Vec<TeamSummaryDto>>>, HttpError> {
    let keyword = query.keyword.or(query.name).unwrap_or_default();
    let teams = state
        .services
        .team_service
        .search_teams(&keyword)
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::success(
        teams.into_iter().map(TeamSummaryDto::from).collect(),
    )))
}

pub async fn get_team_handler(
    State(state): State<AppState>,
    Path(team_id): Path<String>,
) -> Result<Json<ApiResponse<TeamDetailDto>>, HttpError> {
    let detail = state
        .services
        .team_service
        .get_team_detail(&team_id)
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::success(TeamDetailDto::from(detail))))
}

pub async fn join_team_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<JoinTeamRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    state
        .services
        .team_service
        .join_team(&principal, &payload.team_id, payload.password.as_deref())
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::message("加入球队成功")))
}

pub async fn my_teams_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<Vec<TeamDto>>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let teams = state
        .services
        .team_service
        .list_my_teams(&principal)
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::success(
        teams.into_iter().map(TeamDto::from).collect(),
    )))
}

pub async fn user_teams_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<Vec<TeamDto>>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let teams = state
        .services
        .team_service
        .list_user_teams_for_target(&principal, user_id)
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::success(
        teams.into_iter().map(TeamDto::from).collect(),
    )))
}

pub async fn update_team_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
    Json(payload): Json<UpdateTeamRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    state
        .services
        .team_service
        .update_team(
            &principal,
            &team_id,
            UpdateTeamCommand {
                name: payload.name,
                description: payload.description,
                logo_url: payload.logo_url,
                captain_id: payload.captain_id,
                status: payload.status,
                join_password: payload.join_password,
            },
        )
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::message("球队更新成功")))
}

pub async fn upload_team_logo_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<TeamLogoUploadResponse>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);

    let mut logo_bytes = None;
    let mut content_type = None;
    let mut file_name = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|error| AppError::Validation(format!("读取上传内容失败: {error}")))?
    {
        if field.name() != Some("file") || logo_bytes.is_some() {
            continue;
        }

        content_type = field.content_type().map(str::to_string);
        file_name = field.file_name().map(str::to_string);
        let bytes = field
            .bytes()
            .await
            .map_err(|error| AppError::Validation(format!("读取球队 Logo 失败: {error}")))?;
        logo_bytes = Some(bytes);
        break;
    }

    let logo_bytes =
        logo_bytes.ok_or_else(|| AppError::Validation("请上传球队 Logo".to_string()))?;
    if logo_bytes.is_empty() {
        return Err(AppError::Validation("球队 Logo 不能为空".to_string()).into());
    }
    if logo_bytes.len() > 1024 * 1024 {
        return Err(AppError::Validation("球队 Logo 不能超过 1MB".to_string()).into());
    }

    let extension = detect_image_extension(content_type.as_deref(), file_name.as_deref())
        .ok_or_else(|| AppError::Validation("球队 Logo 仅支持 jpg/png/webp".to_string()))?;
    let file_name = format!("team-{}-{}.{}", team_id, Uuid::new_v4(), extension);
    let object_key = format!("team-logos/{file_name}");
    let logo_url = save_upload_bytes(
        &state.config,
        &headers,
        team_logo_upload_dir(),
        "team-logos",
        &object_key,
        &logo_bytes,
    )
    .await?;

    state
        .services
        .team_service
        .update_team(
            &principal,
            &team_id,
            UpdateTeamCommand {
                name: None,
                description: None,
                logo_url: Some(Some(logo_url.clone())),
                captain_id: None,
                status: None,
                join_password: None,
            },
        )
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::with_message(
        "球队 Logo 上传成功",
        TeamLogoUploadResponse { logo_url },
    )))
}

pub async fn delete_team_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    state
        .services
        .team_service
        .delete_team(&principal, &team_id)
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::message("球队删除成功")))
}

pub async fn password_info_handler(
    State(state): State<AppState>,
    Path(team_id): Path<String>,
) -> Result<Json<ApiResponse<TeamPasswordInfoDto>>, HttpError> {
    let requires_password = state
        .services
        .team_service
        .get_team_password_info(&team_id)
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::success(TeamPasswordInfoDto {
        team_id,
        requires_password,
    })))
}

pub async fn add_member_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
    Json(payload): Json<AddTeamMemberRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    state
        .services
        .team_service
        .add_member(
            &principal,
            &team_id,
            AddTeamMemberCommand {
                user_id: payload.user_id,
                role: payload.role,
                jersey_number: payload.jersey_number,
            },
        )
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::message("添加队员成功")))
}

pub async fn remove_member_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((team_id, user_id)): Path<(String, i64)>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    state
        .services
        .team_service
        .remove_member(&principal, &team_id, user_id)
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::message("移除队员成功")))
}

pub async fn update_member_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((team_id, user_id)): Path<(String, i64)>,
    Json(payload): Json<UpdateTeamMemberRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    state
        .services
        .team_service
        .update_member(
            &principal,
            &team_id,
            user_id,
            UpdateTeamMemberCommand {
                role: payload.role,
                jersey_number: payload.jersey_number,
            },
        )
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::message("更新队员成功")))
}

pub async fn batch_remove_members_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
    Json(payload): Json<BatchRemoveMembersRequest>,
) -> Result<Json<ApiResponse<u64>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let removed_count = state
        .services
        .team_service
        .batch_remove_members(&principal, &team_id, &payload.user_ids)
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::with_message(
        "批量移除队员成功",
        removed_count,
    )))
}

pub async fn batch_update_member_status_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
    Json(payload): Json<BatchUpdateMemberStatusRequest>,
) -> Result<Json<ApiResponse<u64>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let updated_count = state
        .services
        .team_service
        .batch_update_member_status(&principal, &team_id, &payload.user_ids, payload.status)
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::with_message(
        "批量更新队员状态成功",
        updated_count,
    )))
}

/// 管理后台：创建球队（Admin 专用，可指定初始队长）
pub async fn admin_create_team_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AdminCreateTeamRequest>,
) -> Result<Json<ApiResponse<TeamDto>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let team = state
        .services
        .team_service
        .admin_create_team(
            &principal,
            CreateTeamCommand {
                name: payload.name,
                description: payload.description,
                logo_url: payload.logo_url,
                join_password: payload.join_password,
            },
            payload.captain_id,
        )
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::with_message(
        "球队创建成功",
        TeamDto::from(team),
    )))
}

/// 管理后台：球队详情（队员含球员信息 + 负责管理员列表）
pub async fn admin_team_detail_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
) -> Result<Json<ApiResponse<TeamDetailForAdminDto>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let detail = state
        .services
        .team_service
        .get_team_detail_for_admin(&principal, &team_id)
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::success(TeamDetailForAdminDto::from(
        detail,
    ))))
}

/// 超级管理员为球队指定后台管理员
pub async fn assign_admin_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
    Json(payload): Json<AssignAdminRequest>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    state
        .services
        .team_service
        .assign_admin_to_team(&principal, &team_id, payload.admin_id)
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::message("管理员分配成功")))
}

/// 超级管理员取消球队管理员分配
pub async fn unassign_admin_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((team_id, admin_id)): Path<(String, i64)>,
) -> Result<Json<ApiResponse<()>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    state
        .services
        .team_service
        .unassign_admin_from_team(&principal, &team_id, admin_id)
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::message("管理员取消分配成功")))
}

/// 查询球队的后台管理员列表
pub async fn list_team_admins_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
) -> Result<Json<ApiResponse<Vec<TeamAdminInfoDto>>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let admins = state
        .services
        .team_service
        .list_team_assigned_admins(&principal, &team_id)
        .await
        .map_err(team_http_error)?;
    Ok(Json(ApiResponse::success(
        admins.into_iter().map(TeamAdminInfoDto::from).collect(),
    )))
}

pub async fn team_credit_overview_handler(
    State(state): State<AppState>,
    Path(team_id): Path<String>,
) -> Result<Json<ApiResponse<TeamCreditOverviewDto>>, HttpError> {
    let overview = state
        .services
        .team_service
        .get_credit_overview(&team_id)
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::success(TeamCreditOverviewDto::from(
        overview,
    ))))
}

pub async fn list_team_credit_transactions_handler(
    State(state): State<AppState>,
    Path(team_id): Path<String>,
    Query(query): Query<TeamCreditTransactionsQuery>,
) -> Result<Json<ApiResponse<Vec<TeamCreditTransactionDto>>>, HttpError> {
    let items = state
        .services
        .team_service
        .list_credit_transactions(&team_id, query.limit.unwrap_or(20))
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::success(
        items
            .into_iter()
            .map(TeamCreditTransactionDto::from)
            .collect(),
    )))
}

pub async fn submit_activity_review_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
    Json(payload): Json<SubmitActivityReviewRequest>,
) -> Result<Json<ApiResponse<TeamCreditOverviewDto>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let overview = state
        .services
        .team_service
        .submit_activity_review(
            &principal,
            &team_id,
            SubmitActivityReviewCommand {
                activity_id: payload.activity_id,
                reviewer_team_id: payload.reviewer_team_id,
                rating: payload.rating,
                comment: payload.comment,
            },
        )
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::with_message(
        "赛后互评提交成功",
        TeamCreditOverviewDto::from(overview),
    )))
}

pub async fn recharge_team_membership_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
    Json(payload): Json<TeamMembershipRechargeRequest>,
) -> Result<Json<ApiResponse<TeamCreditOverviewDto>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let overview = state
        .services
        .team_service
        .recharge_membership(
            &principal,
            &team_id,
            TeamMembershipRechargeCommand {
                months: payload.months,
                note: payload.note,
            },
        )
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::with_message(
        "会员开通成功",
        TeamCreditOverviewDto::from(overview),
    )))
}

pub async fn team_credit_penalty_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(team_id): Path<String>,
    Json(payload): Json<TeamCreditPenaltyRequest>,
) -> Result<Json<ApiResponse<TeamCreditOverviewDto>>, HttpError> {
    let principal = team_principal(state.actor(&headers)?);
    let overview = state
        .services
        .team_service
        .apply_credit_penalty(
            &principal,
            &team_id,
            TeamCreditPenaltyCommand {
                points: payload.points,
                reason: payload.reason,
            },
        )
        .await
        .map_err(team_http_error)?;

    Ok(Json(ApiResponse::with_message(
        "信用罚扣成功",
        TeamCreditOverviewDto::from(overview),
    )))
}
