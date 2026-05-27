use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::team::ports::{TeamCommandRepository, TeamQueryRepository};
use crate::user::application::commands::{CreateRoleUserCommand, RoleUserKind};
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
    team_query_repository: Arc<dyn TeamQueryRepository>,
    team_command_repository: Arc<dyn TeamCommandRepository>,
}

impl ManagePlayerUseCase {
    pub fn new(
        query_repository: Arc<dyn UserQueryRepository>,
        command_repository: Arc<dyn UserCommandRepository>,
        team_query_repository: Arc<dyn TeamQueryRepository>,
        team_command_repository: Arc<dyn TeamCommandRepository>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            team_query_repository,
            team_command_repository,
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
        is_venue: Option<bool>,
    ) -> Result<User, AppError> {
        ensure_admin(actor)?;
        if real_name.trim().is_empty() {
            return Err(AppError::Validation("真实姓名不能为空".to_string()));
        }

        let open_id = format!("admin_created_{}", uuid::Uuid::new_v4());
        let mut user = User::new(open_id, None, None, nickname, None);
        user.real_name = real_name.trim().to_string();
        user.phone_number = phone_number.unwrap_or_default();
        user.is_venue = if is_venue.unwrap_or(false) { 1 } else { 0 };

        self.command_repository
            .create(&user)
            .await
            .map_err(|error| AppError::internal(format!("创建球员失败: {error}")))
    }

    pub async fn create_role_user(
        &self,
        actor: &ActorContext,
        command: CreateRoleUserCommand,
    ) -> Result<User, AppError> {
        ensure_super_admin(actor)?;
        let username = command.username.trim();
        let password = command.password.trim();
        let real_name = command.real_name.trim();
        if username.is_empty() {
            return Err(AppError::Validation("账号不能为空".to_string()));
        }
        if password.is_empty() {
            return Err(AppError::Validation("密码不能为空".to_string()));
        }
        if real_name.is_empty() {
            return Err(AppError::Validation("真实姓名不能为空".to_string()));
        }
        if self
            .query_repository
            .find_by_username(username)
            .await
            .map_err(|error| AppError::internal(format!("检查账号失败: {error}")))?
            .is_some()
        {
            return Err(AppError::Conflict("账号已存在".to_string()));
        }

        if command.role == RoleUserKind::Captain {
            let team_id = command
                .team_id
                .ok_or_else(|| AppError::Validation("队长用户必须绑定球队".to_string()))?;
            self.team_query_repository
                .find_by_id(team_id)
                .await
                .map_err(|error| AppError::internal(format!("查询球队失败: {error}")))?
                .ok_or_else(|| AppError::NotFound("球队不存在".to_string()))?;
        }

        let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST)
            .map_err(|error| AppError::internal(format!("加密用户密码失败: {error}")))?;
        let open_id = format!("admin_role_user_{}", uuid::Uuid::new_v4());
        let mut user = User::new(
            open_id,
            None,
            Some(username.to_string()),
            command.nickname,
            None,
        );
        user.real_name = real_name.to_string();
        user.phone_number = command.phone_number.unwrap_or_default();
        user.password_hash = Some(password_hash);
        user.is_venue = if command.role == RoleUserKind::Venue {
            1
        } else {
            0
        };

        let user = self
            .command_repository
            .create(&user)
            .await
            .map_err(|error| match error {
                crate::user::domain::DomainError::UserAlreadyExists => {
                    AppError::Conflict("用户已存在".to_string())
                }
                other => AppError::internal(format!("创建角色用户失败: {other}")),
            })?;

        if command.role == RoleUserKind::Captain {
            let team_id = command.team_id.expect("captain team_id checked above");
            self.team_command_repository
                .set_captain_member(team_id, user.id)
                .await
                .map_err(|error| AppError::internal(format!("设置球队队长失败: {error}")))?;
        }

        Ok(user)
    }

    pub async fn change_role_user_password(
        &self,
        actor: &ActorContext,
        user_id: i64,
        password: String,
    ) -> Result<User, AppError> {
        ensure_super_admin(actor)?;
        let password = password.trim();
        if password.is_empty() {
            return Err(AppError::Validation("密码不能为空".to_string()));
        }
        let user = self.get_user_info(user_id).await?;
        if !self.is_role_user(&user).await? {
            return Err(AppError::Validation(
                "只能修改队长或场馆用户的密码".to_string(),
            ));
        }
        let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST)
            .map_err(|error| AppError::internal(format!("加密用户密码失败: {error}")))?;
        self.command_repository
            .update_password_hash(user_id, &password_hash)
            .await
            .map_err(|error| AppError::internal(format!("修改密码失败: {error}")))?;

        self.get_user_info(user_id).await
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

    pub async fn mark_user_as_venue(
        &self,
        actor: &ActorContext,
        user_id: i64,
    ) -> Result<User, AppError> {
        ensure_super_admin(actor)?;
        self.get_user_info(user_id).await?;
        self.command_repository
            .update_fields(
                user_id,
                UpdateUserFields {
                    is_venue: Some(true),
                    ..Default::default()
                },
            )
            .await
            .map_err(|error| AppError::internal(format!("设置场馆身份失败: {error}")))?;

        self.get_user_info(user_id).await
    }

    pub async fn remove_venue(
        &self,
        actor: &ActorContext,
        user_id: i64,
    ) -> Result<Option<User>, AppError> {
        ensure_super_admin(actor)?;
        let user = self.get_user_info(user_id).await?;
        if user.is_venue != 1 {
            return Err(AppError::Validation("目标用户当前不是场馆".to_string()));
        }

        if is_standalone_venue_account(&user) {
            self.command_repository
                .delete(user_id)
                .await
                .map_err(|error| AppError::internal(format!("删除场馆账号失败: {error}")))?;
            return Ok(None);
        }

        self.command_repository
            .update_fields(
                user_id,
                UpdateUserFields {
                    is_venue: Some(false),
                    ..Default::default()
                },
            )
            .await
            .map_err(|error| AppError::internal(format!("移除场馆身份失败: {error}")))?;

        self.get_user_info(user_id).await.map(Some)
    }

    async fn get_user_info(&self, target_user_id: i64) -> Result<User, AppError> {
        self.query_repository
            .find_by_id(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))
    }

    async fn is_role_user(&self, user: &User) -> Result<bool, AppError> {
        if user.is_venue == 1 {
            return Ok(true);
        }
        let teams = self
            .query_repository
            .find_player_teams(&[user.id])
            .await
            .map_err(|error| AppError::internal(format!("查询用户球队身份失败: {error}")))?;
        Ok(teams.into_iter().any(|(_, team)| team.role == "captain"))
    }
}

fn ensure_super_admin(actor: &ActorContext) -> Result<(), AppError> {
    ensure_admin(actor)?;
    if !actor.is_super_admin {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

fn is_standalone_venue_account(user: &User) -> bool {
    user.open_id.starts_with("admin_role_user_") && user.password_hash.is_some()
}
