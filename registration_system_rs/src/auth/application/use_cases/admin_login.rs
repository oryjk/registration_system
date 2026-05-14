use crate::auth::application::read_models::AdminLoginResult;
use crate::auth::ports::{AdminUserCommandRepository, AdminUserQueryRepository};
use crate::shared::error::AppError;
use crate::shared::ports::TokenServicePort;
use std::sync::Arc;

#[derive(Clone)]
pub struct AdminLoginUseCase {
    query_repository: Arc<dyn AdminUserQueryRepository>,
    command_repository: Arc<dyn AdminUserCommandRepository>,
    token_service: Arc<dyn TokenServicePort>,
}

impl AdminLoginUseCase {
    pub fn new(
        query_repository: Arc<dyn AdminUserQueryRepository>,
        command_repository: Arc<dyn AdminUserCommandRepository>,
        token_service: Arc<dyn TokenServicePort>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            token_service,
        }
    }

    pub async fn execute(
        &self,
        username: &str,
        password: &str,
    ) -> Result<AdminLoginResult, AppError> {
        let admin = self
            .query_repository
            .find_by_username(username)
            .await
            .map_err(|error| AppError::internal(format!("查询管理员失败: {error}")))?
            .ok_or(AppError::Unauthorized)?;

        if admin.status != 1 {
            return Err(AppError::Forbidden);
        }

        let password_ok = bcrypt::verify(password, &admin.password_hash)
            .map_err(|error| AppError::internal(format!("校验管理员密码失败: {error}")))?;

        if !password_ok {
            return Err(AppError::Unauthorized);
        }

        self.command_repository
            .update_last_login(admin.id)
            .await
            .map_err(|error| AppError::internal(format!("更新管理员登录时间失败: {error}")))?;

        let access_token = self
            .token_service
            .issue_admin_token(admin.id, admin.is_super_admin == 1)?;

        Ok(AdminLoginResult {
            access_token,
            admin,
        })
    }
}
