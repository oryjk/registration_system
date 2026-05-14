use crate::auth::domain::AdminUser;
use crate::auth::ports::AdminUserQueryRepository;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct AdminPermissionChecker {
    query_repository: Arc<dyn AdminUserQueryRepository>,
}

impl AdminPermissionChecker {
    pub fn new(query_repository: Arc<dyn AdminUserQueryRepository>) -> Self {
        Self { query_repository }
    }

    pub async fn verify_admin(&self, actor: &ActorContext) -> Result<AdminUser, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }

        self.query_repository
            .find_by_id(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询管理员失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("管理员不存在".to_string()))
    }

    pub async fn ensure_super_admin(&self, actor: &ActorContext) -> Result<AdminUser, AppError> {
        let current_admin = self.verify_admin(actor).await?;
        if current_admin.is_super_admin != 1 {
            return Err(AppError::Forbidden);
        }
        Ok(current_admin)
    }
}
