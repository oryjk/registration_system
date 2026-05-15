use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::user::application::commands::UpdateUserCommand;
use crate::user::application::permissions::{ensure_admin, ensure_admin_or_self, ensure_user};
use crate::user::domain::{UpdateUserFields, User};
use crate::user::ports::{UserCommandRepository, UserQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct UserProfileUseCase {
    query_repository: Arc<dyn UserQueryRepository>,
    command_repository: Arc<dyn UserCommandRepository>,
}

impl UserProfileUseCase {
    pub fn new(
        query_repository: Arc<dyn UserQueryRepository>,
        command_repository: Arc<dyn UserCommandRepository>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
        }
    }

    pub async fn get_current_user(&self, actor: &ActorContext) -> Result<User, AppError> {
        ensure_user(actor)?;

        self.query_repository
            .find_by_id(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询当前用户失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))
    }

    pub async fn update_profile(
        &self,
        actor: &ActorContext,
        nickname: Option<&str>,
        real_name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<User, AppError> {
        ensure_user(actor)?;

        self.command_repository
            .update_profile(actor.id, nickname, real_name, avatar_url)
            .await
            .map_err(|error| AppError::internal(format!("更新用户资料失败: {error}")))?;

        self.get_current_user(actor).await
    }

    pub async fn update_user_by_target(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
        command: UpdateUserCommand<'_>,
    ) -> Result<User, AppError> {
        ensure_admin_or_self(actor, target_user_id)?;

        self.command_repository
            .update_fields(
                target_user_id,
                UpdateUserFields {
                    nickname: command.nickname,
                    real_name: command.real_name,
                    avatar_url: command.avatar_url,
                    phone_number: None,
                    is_manager: command.is_manager,
                    is_venue: command.is_venue,
                    status: command.status,
                    leave_start_time: command.leave_start_time,
                    leave_end_time: command.leave_end_time,
                },
            )
            .await
            .map_err(|error| AppError::internal(format!("更新用户失败: {error}")))?;

        self.get_user_info(target_user_id).await
    }

    pub async fn delete_user(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<(), AppError> {
        ensure_admin(actor)?;
        self.command_repository
            .delete(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("删除用户失败: {error}")))
    }

    pub async fn get_user_info(&self, target_user_id: i64) -> Result<User, AppError> {
        self.query_repository
            .find_by_id(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))
    }

    pub async fn update_user_phone(
        &self,
        actor: &ActorContext,
        user_id: i64,
        phone: &str,
    ) -> Result<(), AppError> {
        ensure_admin(actor)?;
        self.command_repository
            .update_fields(
                user_id,
                UpdateUserFields {
                    phone_number: Some(phone),
                    ..Default::default()
                },
            )
            .await
            .map_err(|error| AppError::internal(format!("更新手机号失败: {error}")))
    }

    pub async fn bind_current_user_phone(
        &self,
        actor: &ActorContext,
        phone: &str,
    ) -> Result<User, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        let phone = phone.trim();
        if phone.is_empty() {
            return Err(AppError::Validation("手机号不能为空".to_string()));
        }

        self.command_repository
            .update_fields(
                actor.id,
                UpdateUserFields {
                    phone_number: Some(phone),
                    ..Default::default()
                },
            )
            .await
            .map_err(|error| AppError::internal(format!("绑定手机号失败: {error}")))?;

        self.get_current_user(actor).await
    }
}
