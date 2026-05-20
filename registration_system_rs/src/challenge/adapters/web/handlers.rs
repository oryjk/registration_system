use crate::bootstrap::app::AppState;
use crate::challenge::adapters::web::dto::{
    AcceptChallengeRequest, ChallengeDetailDto, ChallengeDto, ChallengeListQuery,
    ChallengeSummaryDto, CreateChallengeRequest, UpdateChallengeRequest,
};
use crate::challenge::application::{
    AcceptChallengeCommand, AdminChallengeListQuery, CreateChallengeCommand,
    PublicChallengeListQuery, TeamChallengeListRequest, UpdateChallengeCommand,
};
use crate::challenge::domain::{ChallengeKind, ChallengeStatus};
use crate::shared::api_response::ApiResponse;
use crate::shared::http_error::HttpError;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;

pub async fn create_challenge_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateChallengeRequest>,
) -> Result<Json<ApiResponse<ChallengeDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let kind = match payload.kind.as_str() {
        "team" => ChallengeKind::Team,
        "individual" => ChallengeKind::Individual,
        _ => {
            return Err(HttpError(crate::shared::error::AppError::Validation(
                "无效的约队类型".to_string(),
            )));
        }
    };
    let challenge = state
        .services
        .challenge_service
        .create_challenge(
            &actor,
            CreateChallengeCommand {
                kind,
                host_team_id: payload.host_team_id,
                host_user_id: payload.host_user_id,
                title: payload.title,
                holding_date: payload.holding_date,
                start_time: payload.start_time,
                end_time: payload.end_time,
                location: payload.location,
                location_latitude: payload.location_latitude,
                location_longitude: payload.location_longitude,
                players_per_team: payload.players_per_team,
                fee_per_person: payload.fee_per_person,
                note: payload.note,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "约队发布成功",
        ChallengeDto::from(challenge),
    )))
}

pub async fn list_challenges_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ChallengeListQuery>,
) -> Result<Json<ApiResponse<Vec<ChallengeSummaryDto>>>, HttpError> {
    let actor = state.optional_actor(&headers)?;
    let status = match query.status.as_deref() {
        Some("open") => Some(ChallengeStatus::Open),
        Some("matched") => Some(ChallengeStatus::Matched),
        Some("cancelled") => Some(ChallengeStatus::Cancelled),
        Some(_) => {
            return Err(HttpError(crate::shared::error::AppError::Validation(
                "无效的约队状态筛选".to_string(),
            )));
        }
        None => None,
    };
    let kind = match query.kind.as_deref() {
        Some("team") => Some(ChallengeKind::Team),
        Some("individual") => Some(ChallengeKind::Individual),
        Some(_) => {
            return Err(HttpError(crate::shared::error::AppError::Validation(
                "无效的约队类型筛选".to_string(),
            )));
        }
        None => None,
    };
    let items = if let Some(actor) =
        actor.filter(|actor| actor.actor_kind == crate::shared::auth::ActorKind::Admin)
    {
        state
            .services
            .challenge_service
            .list_for_admin(
                &actor,
                AdminChallengeListQuery {
                    team_id: query.team_id,
                    keyword: query.keyword,
                    status,
                    kind,
                    include_closed: query.include_closed.unwrap_or(false),
                    limit: query.limit.unwrap_or(50),
                    sort: query.sort.unwrap_or_else(|| "holding_date_asc".to_string()),
                },
            )
            .await?
    } else if let (Some(actor), Some(team_id)) = (actor, query.team_id) {
        state
            .services
            .challenge_service
            .list_for_team(
                &actor,
                TeamChallengeListRequest {
                    team_id,
                    keyword: query.keyword.as_deref(),
                    status,
                    kind,
                    include_closed: query.include_closed.unwrap_or(false),
                    limit: query.limit.unwrap_or(20),
                    sort: query.sort.as_deref().unwrap_or("holding_date_asc"),
                },
            )
            .await?
    } else {
        let viewer_user_id = actor
            .filter(|actor| actor.actor_kind == crate::shared::auth::ActorKind::User)
            .map(|actor| actor.id);
        state
            .services
            .challenge_service
            .list_public(PublicChallengeListQuery {
                viewer_user_id,
                keyword: query.keyword.as_deref(),
                status,
                kind,
                include_closed: query.include_closed.unwrap_or(false),
                limit: query.limit.unwrap_or(20),
                sort: query.sort.as_deref().unwrap_or("holding_date_asc"),
            })
            .await?
    };

    Ok(Json(ApiResponse::success(
        items.into_iter().map(ChallengeSummaryDto::from).collect(),
    )))
}

pub async fn get_challenge_detail_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(challenge_id): Path<String>,
) -> Result<Json<ApiResponse<ChallengeDetailDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let detail = state
        .services
        .challenge_service
        .get_detail(&actor, &challenge_id)
        .await?
        .ok_or_else(|| {
            HttpError(crate::shared::error::AppError::NotFound(
                "约队不存在".to_string(),
            ))
        })?;

    Ok(Json(ApiResponse::success(ChallengeDetailDto::from(detail))))
}

pub async fn accept_challenge_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(challenge_id): Path<String>,
    Json(payload): Json<AcceptChallengeRequest>,
) -> Result<Json<ApiResponse<ChallengeDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let challenge = state
        .services
        .challenge_service
        .accept_challenge(
            &actor,
            &challenge_id,
            AcceptChallengeCommand {
                guest_team_id: payload.guest_team_id,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "接约成功",
        ChallengeDto::from(challenge),
    )))
}

pub async fn cancel_challenge_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(challenge_id): Path<String>,
) -> Result<Json<ApiResponse<ChallengeDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let challenge = state
        .services
        .challenge_service
        .cancel_challenge(&actor, &challenge_id)
        .await?;

    Ok(Json(ApiResponse::with_message(
        "约队已取消",
        ChallengeDto::from(challenge),
    )))
}

pub async fn update_challenge_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(challenge_id): Path<String>,
    Json(payload): Json<UpdateChallengeRequest>,
) -> Result<Json<ApiResponse<ChallengeDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let challenge = state
        .services
        .challenge_service
        .update_challenge(
            &actor,
            &challenge_id,
            UpdateChallengeCommand {
                title: payload.title,
                holding_date: payload.holding_date,
                start_time: payload.start_time,
                end_time: payload.end_time,
                location: payload.location,
                location_latitude: payload.location_latitude,
                location_longitude: payload.location_longitude,
                players_per_team: payload.players_per_team,
                fee_per_person: payload.fee_per_person,
                note: payload.note,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "约队已更新",
        ChallengeDto::from(challenge),
    )))
}

pub async fn cancel_individual_acceptance_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(challenge_id): Path<String>,
) -> Result<Json<ApiResponse<ChallengeDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let challenge = state
        .services
        .challenge_service
        .cancel_individual_acceptance(&actor, &challenge_id)
        .await?;

    Ok(Json(ApiResponse::with_message(
        "散人报名已取消",
        ChallengeDto::from(challenge),
    )))
}
