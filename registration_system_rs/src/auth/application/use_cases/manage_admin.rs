use crate::auth::application::commands::RegisterAdminCommand;
use crate::auth::application::permissions::AdminPermissionChecker;
use crate::auth::domain::{AdminUser, DomainError};
use crate::auth::ports::{AdminUserCommandRepository, AdminUserQueryRepository};
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct ManageAdminUseCase {
    query_repository: Arc<dyn AdminUserQueryRepository>,
    command_repository: Arc<dyn AdminUserCommandRepository>,
    permission_checker: AdminPermissionChecker,
}

impl ManageAdminUseCase {
    pub fn new(
        query_repository: Arc<dyn AdminUserQueryRepository>,
        command_repository: Arc<dyn AdminUserCommandRepository>,
        permission_checker: AdminPermissionChecker,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            permission_checker,
        }
    }

    pub async fn register_admin(
        &self,
        actor: &ActorContext,
        command: RegisterAdminCommand<'_>,
    ) -> Result<AdminUser, AppError> {
        self.permission_checker.ensure_super_admin(actor).await?;
        if command.username.trim().is_empty() || command.password.trim().is_empty() {
            return Err(AppError::Validation("用户名和密码不能为空".to_string()));
        }
        if self
            .query_repository
            .find_by_username(command.username)
            .await
            .map_err(|error| AppError::internal(format!("检查管理员账号失败: {error}")))?
            .is_some()
        {
            return Err(AppError::Conflict("管理员用户名已存在".to_string()));
        }
        let password_hash = bcrypt::hash(command.password, bcrypt::DEFAULT_COST)
            .map_err(|error| AppError::internal(format!("生成管理员密码失败: {error}")))?;
        self.command_repository
            .create(
                command.username,
                &password_hash,
                command.nickname.unwrap_or(command.username),
                command.is_super_admin,
            )
            .await
            .map_err(|error| match error {
                DomainError::AdminAlreadyExists => {
                    AppError::Conflict("管理员用户名已存在".to_string())
                }
                other => AppError::internal(format!("创建管理员失败: {other}")),
            })
    }

    pub async fn list_admins(&self, actor: &ActorContext) -> Result<Vec<AdminUser>, AppError> {
        self.permission_checker.verify_admin(actor).await?;
        self.query_repository
            .list()
            .await
            .map_err(|error| AppError::internal(format!("查询管理员列表失败: {error}")))
    }

    pub async fn update_admin_status(
        &self,
        actor: &ActorContext,
        admin_id: i64,
        status: i8,
    ) -> Result<(), AppError> {
        self.permission_checker.ensure_super_admin(actor).await?;
        self.command_repository
            .update_status(admin_id, status)
            .await
            .map_err(|error| AppError::internal(format!("更新管理员状态失败: {error}")))
    }

    pub async fn delete_admin(&self, actor: &ActorContext, admin_id: i64) -> Result<(), AppError> {
        let current_admin = self.permission_checker.ensure_super_admin(actor).await?;
        if current_admin.id == admin_id {
            return Err(AppError::Validation("不能删除当前登录管理员".to_string()));
        }
        self.command_repository
            .delete(admin_id)
            .await
            .map_err(|error| AppError::internal(format!("删除管理员失败: {error}")))
    }
}
