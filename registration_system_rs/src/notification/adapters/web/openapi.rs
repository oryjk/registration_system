#![allow(dead_code)]

use super::dto::{
    MarkAllReadResultDto, NotificationDto, NotificationListQuery, NotificationUnreadCountDto,
};
use crate::shared::api_response::{ApiResponse, EmptyData};
use crate::shared::openapi::BearerSecurityAddon;
use utoipa::OpenApi;

#[utoipa::path(
    get,
    path = "/",
    tag = "Notification",
    security(("bearer_auth" = [])),
    params(NotificationListQuery),
    responses(
        (status = 200, description = "查询通知列表成功", body = ApiResponse<Vec<NotificationDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn list_notifications_doc() {}

#[utoipa::path(
    get,
    path = "/unread-count",
    tag = "Notification",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "查询未读数成功", body = ApiResponse<NotificationUnreadCountDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn unread_count_doc() {}

#[utoipa::path(
    post,
    path = "/read-all",
    tag = "Notification",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "全部标记已读成功", body = ApiResponse<MarkAllReadResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn mark_all_read_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        list_notifications_doc,
        unread_count_doc,
        mark_all_read_doc
    ),
    components(
        schemas(
            ApiResponse<Vec<NotificationDto>>,
            ApiResponse<NotificationUnreadCountDto>,
            ApiResponse<MarkAllReadResultDto>,
            ApiResponse<EmptyData>,
            EmptyData,
            NotificationDto,
            NotificationUnreadCountDto,
            MarkAllReadResultDto
        )
    ),
    tags(
        (name = "Notification", description = "站内通知与未读状态")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct NotificationApiDoc;
