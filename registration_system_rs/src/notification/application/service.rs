use crate::notification::domain::Notification;
use crate::notification::ports::NotificationRepository;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use chrono::Utc;
use std::collections::BTreeSet;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct NotificationService {
    repository: Arc<dyn NotificationRepository>,
}

impl NotificationService {
    pub fn new(repository: Arc<dyn NotificationRepository>) -> Self {
        Self { repository }
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

        self.repository
            .create_many(&notifications)
            .await
            .map_err(|error| AppError::internal(format!("创建通知失败: {error}")))?;

        Ok(notifications.len())
    }

    pub async fn list_my_notifications(
        &self,
        actor: &ActorContext,
        unread_only: bool,
        limit: i64,
    ) -> Result<Vec<Notification>, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        self.repository
            .list_for_user(actor.id, unread_only, limit)
            .await
            .map_err(|error| AppError::internal(format!("查询通知列表失败: {error}")))
    }

    pub async fn get_unread_count(&self, actor: &ActorContext) -> Result<i64, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        self.repository
            .count_unread(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询未读通知失败: {error}")))
    }

    pub async fn mark_all_read(&self, actor: &ActorContext) -> Result<u64, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        self.repository
            .mark_all_read(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("标记通知已读失败: {error}")))
    }
}
