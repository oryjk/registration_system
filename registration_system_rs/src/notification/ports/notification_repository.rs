use crate::notification::domain::{DomainError, Notification};
use async_trait::async_trait;

#[async_trait]
pub trait NotificationQueryRepository: Send + Sync {
    async fn list_for_user(
        &self,
        user_id: i64,
        unread_only: bool,
        limit: i64,
    ) -> Result<Vec<Notification>, DomainError>;
    async fn count_unread(&self, user_id: i64) -> Result<i64, DomainError>;
}

#[async_trait]
pub trait NotificationCommandRepository: Send + Sync {
    async fn create_many(&self, notifications: &[Notification]) -> Result<(), DomainError>;
    async fn mark_all_read(&self, user_id: i64) -> Result<u64, DomainError>;
}
