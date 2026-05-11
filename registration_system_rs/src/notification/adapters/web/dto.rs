use crate::notification::domain::Notification;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

#[derive(Debug, Deserialize, IntoParams)]
pub struct NotificationListQuery {
    pub unread_only: Option<bool>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct NotificationDto {
    pub id: String,
    pub user_id: i64,
    pub kind: String,
    pub title: String,
    pub content: String,
    pub related_type: Option<String>,
    pub related_id: Option<String>,
    pub read_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
}

impl From<Notification> for NotificationDto {
    fn from(value: Notification) -> Self {
        Self {
            id: value.id,
            user_id: value.user_id,
            kind: value.kind,
            title: value.title,
            content: value.content,
            related_type: value.related_type,
            related_id: value.related_id,
            read_at: value.read_at,
            created_at: value.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct NotificationUnreadCountDto {
    pub unread_count: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MarkAllReadResultDto {
    pub affected: u64,
}
