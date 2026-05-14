use crate::notification::domain::Notification;
use crate::notification::ports::NotificationCommandRepository;
use crate::shared::error::AppError;
use chrono::Utc;
use std::collections::BTreeSet;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct SendNotificationUseCase {
    command_repository: Arc<dyn NotificationCommandRepository>,
}

impl SendNotificationUseCase {
    pub fn new(command_repository: Arc<dyn NotificationCommandRepository>) -> Self {
        Self { command_repository }
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
        let unique_user_ids = user_ids
            .iter()
            .copied()
            .filter(|user_id| *user_id > 0)
            .collect::<BTreeSet<_>>();
        if unique_user_ids.is_empty() {
            return Ok(0);
        }

        let now = Utc::now().naive_utc();
        let notifications = unique_user_ids
            .into_iter()
            .map(|user_id| Notification {
                id: Uuid::new_v4().to_string(),
                user_id,
                kind: kind.to_string(),
                title: title.to_string(),
                content: content.to_string(),
                related_type: related_type.map(str::to_string),
                related_id: related_id.map(str::to_string),
                read_at: None,
                created_at: now,
                updated_at: now,
            })
            .collect::<Vec<_>>();

        self.command_repository
            .create_many(&notifications)
            .await
            .map_err(|error| AppError::internal(format!("创建通知失败: {error}")))?;

        Ok(notifications.len())
    }
}
