use crate::shared::auth::ActorKind;
use crate::shared::error::AppError;
use crate::shared::ports::TokenServicePort;
use crate::user::application::read_models::UserLoginResult;
use crate::user::domain::{DomainError, User};
use crate::user::ports::{UserCommandRepository, UserQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct UserLoginUseCase {
    query_repository: Arc<dyn UserQueryRepository>,
    command_repository: Arc<dyn UserCommandRepository>,
    token_service: Arc<dyn TokenServicePort>,
}

impl UserLoginUseCase {
    pub fn new(
        query_repository: Arc<dyn UserQueryRepository>,
        command_repository: Arc<dyn UserCommandRepository>,
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
        open_id: &str,
        union_id: Option<String>,
        username: Option<String>,
        nickname: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<UserLoginResult, AppError> {
        if open_id.trim().is_empty() {
            return Err(AppError::Validation("open_id 不能为空".to_string()));
        }

        let user = match self
            .query_repository
            .find_by_open_id(open_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户失败: {error}")))?
        {
            Some(user) => {
                self.command_repository
                    .touch_login(user.id)
                    .await
                    .map_err(|error| AppError::internal(format!("更新登录时间失败: {error}")))?;
                self.query_repository
                    .find_by_id(user.id)
                    .await
                    .map_err(|error| AppError::internal(format!("重新加载用户失败: {error}")))?
                    .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))?
            }
            None => {
                let user = User::new(
                    open_id.to_string(),
                    union_id,
                    username,
                    nickname,
                    avatar_url,
                );
                self.command_repository
                    .create(&user)
                    .await
                    .map_err(|error| match error {
                        DomainError::UserAlreadyExists => {
                            AppError::Conflict("用户已存在".to_string())
                        }
                        other => AppError::internal(format!("创建用户失败: {other}")),
                    })?
            }
        };

        let access_token = self.token_service.issue_token(ActorKind::User, user.id)?;

        Ok(UserLoginResult { access_token, user })
    }

    pub async fn execute_with_password(
        &self,
        username: &str,
        password: &str,
    ) -> Result<UserLoginResult, AppError> {
        if username.trim().is_empty() || password.trim().is_empty() {
            return Err(AppError::Validation("账号和密码不能为空".to_string()));
        }

        let user = self
            .query_repository
            .find_by_username(username.trim())
            .await
            .map_err(|error| AppError::internal(format!("查询用户失败: {error}")))?
            .ok_or(AppError::Unauthorized)?;

        let Some(password_hash) = user.password_hash.as_deref() else {
            return Err(AppError::Unauthorized);
        };
        let password_ok = bcrypt::verify(password, password_hash)
            .map_err(|error| AppError::internal(format!("校验密码失败: {error}")))?;
        if !password_ok || user.status != 1 {
            return Err(AppError::Unauthorized);
        }

        self.command_repository
            .touch_login(user.id)
            .await
            .map_err(|error| AppError::internal(format!("更新登录时间失败: {error}")))?;
        let user = self
            .query_repository
            .find_by_id(user.id)
            .await
            .map_err(|error| AppError::internal(format!("重新加载用户失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))?;

        let access_token = self.token_service.issue_token(ActorKind::User, user.id)?;
        Ok(UserLoginResult { access_token, user })
    }
}
