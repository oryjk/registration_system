use crate::notification::application::permissions::ensure_user;
use crate::notification::domain::Notification;
use crate::notification::ports::{NotificationCommandRepository, NotificationQueryRepository};
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct QueryNotificationUseCase {
    query_repository: Arc<dyn NotificationQueryRepository>,
    command_repository: Arc<dyn NotificationCommandRepository>,
}

impl QueryNotificationUseCase {
    pub fn new(
        query_repository: Arc<dyn NotificationQueryRepository>,
        command_repository: Arc<dyn NotificationCommandRepository>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
        }
    }

    pub async fn list_my_notifications(
        &self,
        actor: &ActorContext,
        unread_only: bool,
        limit: i64,
    ) -> Result<Vec<Notification>, AppError> {
        ensure_user(actor)?;

        self.query_repository
            .list_for_user(actor.id, unread_only, limit)
            .await
            .map_err(|error| AppError::internal(format!("查询通知列表失败: {error}")))
    }

    pub async fn get_unread_count(&self, actor: &ActorContext) -> Result<i64, AppError> {
        ensure_user(actor)?;

        self.query_repository
            .count_unread(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询未读通知失败: {error}")))
    }

    pub async fn mark_all_read(&self, actor: &ActorContext) -> Result<u64, AppError> {
        ensure_user(actor)?;

        self.command_repository
            .mark_all_read(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("标记通知已读失败: {error}")))
    }
}
