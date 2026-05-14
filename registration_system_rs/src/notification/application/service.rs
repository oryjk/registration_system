use crate::notification::application::use_cases::{
    QueryNotificationUseCase, SendNotificationUseCase,
};
use crate::notification::domain::Notification;
use crate::notification::ports::{NotificationCommandRepository, NotificationQueryRepository};
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct NotificationService {
    send_notification_use_case: SendNotificationUseCase,
    query_notification_use_case: QueryNotificationUseCase,
}

impl NotificationService {
    pub fn new(
        query_repository: Arc<dyn NotificationQueryRepository>,
        command_repository: Arc<dyn NotificationCommandRepository>,
    ) -> Self {
        Self {
            send_notification_use_case: SendNotificationUseCase::new(command_repository.clone()),
            query_notification_use_case: QueryNotificationUseCase::new(
                query_repository,
                command_repository,
            ),
        }
    }

    pub async fn send_to_users(
        &self,
        user_ids: &[i64],
        kind: &str,
        title: &str,
        content: &str,
        related_type: Option<&str>,
        related_id: Option<&str>,
    ) -> Result<usize, AppError> {
        self.send_notification_use_case
            .send_to_users(user_ids, kind, title, content, related_type, related_id)
            .await
    }

    pub async fn list_my_notifications(
        &self,
        actor: &ActorContext,
        unread_only: bool,
        limit: i64,
    ) -> Result<Vec<Notification>, AppError> {
        self.query_notification_use_case
            .list_my_notifications(actor, unread_only, limit)
            .await
    }

    pub async fn get_unread_count(&self, actor: &ActorContext) -> Result<i64, AppError> {
        self.query_notification_use_case
            .get_unread_count(actor)
            .await
    }

    pub async fn mark_all_read(&self, actor: &ActorContext) -> Result<u64, AppError> {
        self.query_notification_use_case.mark_all_read(actor).await
    }
}
