use crate::auth::domain::{AdminUser, DomainError};
use async_trait::async_trait;

#[async_trait]
pub trait AdminUserQueryRepository: Send + Sync {
    async fn find_by_id(&self, admin_id: i64) -> Result<Option<AdminUser>, DomainError>;
    async fn find_by_username(&self, username: &str) -> Result<Option<AdminUser>, DomainError>;
    async fn list(&self) -> Result<Vec<AdminUser>, DomainError>;
}

#[async_trait]
pub trait AdminUserCommandRepository: Send + Sync {
    async fn create(
        &self,
        username: &str,
        password_hash: &str,
        nickname: &str,
        is_super_admin: bool,
    ) -> Result<AdminUser, DomainError>;
    async fn update_status(&self, admin_id: i64, status: i8) -> Result<(), DomainError>;
    async fn delete(&self, admin_id: i64) -> Result<(), DomainError>;
    async fn update_last_login(&self, admin_id: i64) -> Result<(), DomainError>;
}
