use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::user::application::permissions::{ensure_admin, player_admin_scope};
use crate::user::domain::{
    PlayerAdminListQuery, PlayerListResult, PlayerWithTeams, UpdateUserFields, User,
};
use crate::user::ports::{UserCommandRepository, UserQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct ManagePlayerUseCase {
    query_repository: Arc<dyn UserQueryRepository>,
    command_repository: Arc<dyn UserCommandRepository>,
}

impl ManagePlayerUseCase {
    pub fn new(
        query_repository: Arc<dyn UserQueryRepository>,
        command_repository: Arc<dyn UserCommandRepository>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
        }
    }

    pub async fn list_players(
        &self,
        actor: &ActorContext,
        query: PlayerAdminListQuery<'_>,
    ) -> Result<PlayerListResult, AppError> {
        let mut scoped_query = query;
        scoped_query.admin_scope = player_admin_scope(actor)?;
        self.query_repository
            .list_players_admin(scoped_query)
            .await
            .map_err(|error| AppError::internal(format!("查询球员列表失败: {error}")))
    }

    pub async fn admin_create_player(
        &self,
        actor: &ActorContext,
        real_name: String,
        nickname: Option<String>,
        phone_number: Option<String>,
    ) -> Result<User, AppError> {
        ensure_admin(actor)?;
        if real_name.trim().is_empty() {
            return Err(AppError::Validation("真实姓名不能为空".to_string()));
        }

        let open_id = format!("admin_created_{}", uuid::Uuid::new_v4());
        let mut user = User::new(open_id, None, None, nickname, None);
        user.real_name = real_name.trim().to_string();
        user.phone_number = phone_number.unwrap_or_default();

        self.command_repository
            .create(&user)
            .await
            .map_err(|error| AppError::internal(format!("创建球员失败: {error}")))
    }

    pub async fn get_player_detail(
        &self,
        actor: &ActorContext,
        user_id: i64,
    ) -> Result<PlayerWithTeams, AppError> {
        let admin_scope = player_admin_scope(actor)?;
        let result = self
            .query_repository
            .list_players_admin(PlayerAdminListQuery {
                page: 1,
                page_size: 1_000_000,
                admin_scope,
                ..Default::default()
            })
            .await
            .map_err(|error| AppError::internal(format!("查询球员失败: {error}")))?;

        result
            .items
            .into_iter()
            .find(|player| player.id == user_id)
            .ok_or_else(|| AppError::NotFound("球员不存在".to_string()))
    }

    pub async fn freeze_player(
        &self,
        actor: &ActorContext,
        user_id: i64,
        freeze_start: chrono::NaiveDateTime,
        freeze_end: Option<chrono::NaiveDateTime>,
    ) -> Result<User, AppError> {
        ensure_admin(actor)?;
        self.command_repository
            .update_fields(
                user_id,
                UpdateUserFields {
                    status: Some(0_i8),
                    leave_start_time: Some(Some(freeze_start)),
                    leave_end_time: Some(freeze_end),
                    ..Default::default()
                },
            )
            .await
            .map_err(|error| AppError::internal(format!("冻结球员失败: {error}")))?;

        self.get_user_info(user_id).await
    }

    pub async fn unfreeze_player(
        &self,
        actor: &ActorContext,
        user_id: i64,
    ) -> Result<User, AppError> {
        ensure_admin(actor)?;
        self.command_repository
            .update_fields(
                user_id,
                UpdateUserFields {
                    status: Some(1_i8),
                    leave_start_time: Some(None),
                    leave_end_time: Some(None),
                    ..Default::default()
                },
            )
            .await
            .map_err(|error| AppError::internal(format!("解冻球员失败: {error}")))?;

        self.get_user_info(user_id).await
    }

    async fn get_user_info(&self, target_user_id: i64) -> Result<User, AppError> {
        self.query_repository
            .find_by_id(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))
    }
}
