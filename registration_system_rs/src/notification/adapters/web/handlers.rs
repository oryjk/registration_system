use crate::bootstrap::app::AppState;
use crate::notification::adapters::web::dto::{
    MarkAllReadResultDto, NotificationDto, NotificationListQuery, NotificationUnreadCountDto,
};
use crate::shared::api_response::ApiResponse;
use crate::shared::http_error::HttpError;
use axum::Json;
use axum::extract::{Query, State};
use axum::http::HeaderMap;

pub async fn list_notifications_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<NotificationListQuery>,
) -> Result<Json<ApiResponse<Vec<NotificationDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .notification_service
        .list_my_notifications(
            &actor,
            query.unread_only.unwrap_or(false),
            query.limit.unwrap_or(20),
        )
        .await?;

    Ok(Json(ApiResponse::success(
        items.into_iter().map(NotificationDto::from).collect(),
    )))
}

pub async fn unread_count_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<NotificationUnreadCountDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let unread_count = state
        .services
        .notification_service
        .get_unread_count(&actor)
        .await?;

    Ok(Json(ApiResponse::success(NotificationUnreadCountDto {
        unread_count,
    })))
}

pub async fn mark_all_read_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<MarkAllReadResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let affected = state
        .services
        .notification_service
        .mark_all_read(&actor)
        .await?;

    Ok(Json(ApiResponse::with_message(
        "通知已全部标记为已读",
        MarkAllReadResultDto { affected },
    )))
}
