use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::shared::ports::TokenServicePort;
use crate::user::domain::{
    DomainError, PlayerAdminListQuery, PlayerListResult, User, UserActivityRecord,
    UserAttendanceRanking, UserAttendanceRecord,
};
use crate::user::ports::UserRepository;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct UserLoginResult {
    pub access_token: String,
    pub user: User,
}

#[derive(Debug, Default, Clone)]
pub struct UpdateUserCommand<'a> {
    pub nickname: Option<&'a str>,
    pub real_name: Option<&'a str>,
    pub avatar_url: Option<&'a str>,
    pub is_manager: Option<bool>,
    pub status: Option<i8>,
    pub leave_start_time: Option<Option<chrono::NaiveDateTime>>,
    pub leave_end_time: Option<Option<chrono::NaiveDateTime>>,
}

#[derive(Clone)]
pub struct UserService {
    repository: Arc<dyn UserRepository>,
    token_service: Arc<dyn TokenServicePort>,
}

impl UserService {
    pub fn new(
        repository: Arc<dyn UserRepository>,
        token_service: Arc<dyn TokenServicePort>,
    ) -> Self {
        Self {
            repository,
            token_service,
        }
    }

    fn player_admin_scope(actor: &ActorContext) -> Result<Option<i64>, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        Ok(if actor.is_super_admin {
            None
        } else {
            Some(actor.id)
        })
    }

    pub async fn login(
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
            .repository
            .find_by_open_id(open_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户失败: {error}")))?
        {
            Some(user) => {
                self.repository
                    .touch_login(user.id)
                    .await
                    .map_err(|error| AppError::internal(format!("更新登录时间失败: {error}")))?;
                self.repository
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
                self.repository.create(&user).await.map_err(|e| match e {
                    DomainError::UserAlreadyExists => AppError::Conflict("用户已存在".to_string()),
                    e => AppError::internal(format!("创建用户失败: {e}")),
                })?
            }
        };

        let access_token = self.token_service.issue_token(ActorKind::User, user.id)?;

        Ok(UserLoginResult { access_token, user })
    }

    pub async fn get_current_user(&self, actor: &ActorContext) -> Result<User, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        self.repository
            .find_by_id(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询当前用户失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))
    }

    pub async fn list_users(&self) -> Result<Vec<User>, AppError> {
        self.repository
            .list_active()
            .await
            .map_err(|error| AppError::internal(format!("查询用户列表失败: {error}")))
    }

    pub async fn search_users(
        &self,
        actor: &ActorContext,
        keyword: &str,
        limit: i64,
    ) -> Result<Vec<User>, AppError> {
        let _ = actor;
        self.repository
            .search(keyword, limit)
            .await
            .map_err(|error| AppError::internal(format!("搜索用户失败: {error}")))
    }

    pub async fn update_profile(
        &self,
        actor: &ActorContext,
        nickname: Option<&str>,
        real_name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<User, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        self.repository
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
        if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
            return Err(AppError::Forbidden);
        }

        self.repository
            .update_fields(
                target_user_id,
                crate::user::domain::UpdateUserFields {
                    nickname: command.nickname,
                    real_name: command.real_name,
                    avatar_url: command.avatar_url,
                    phone_number: None,
                    is_manager: command.is_manager,
                    status: command.status,
                    leave_start_time: command.leave_start_time,
                    leave_end_time: command.leave_end_time,
                },
            )
            .await
            .map_err(|error| AppError::internal(format!("更新用户失败: {error}")))?;

        self.repository
            .find_by_id(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))
    }

    pub async fn delete_user(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<(), AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        self.repository
            .delete(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("删除用户失败: {error}")))
    }

    pub async fn get_user_info(&self, target_user_id: i64) -> Result<User, AppError> {
        self.repository
            .find_by_id(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))
    }

    pub async fn get_user_activities(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<Vec<UserActivityRecord>, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
            return Err(AppError::Forbidden);
        }
        self.repository
            .find_activities(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户活动失败: {error}")))
    }

    pub async fn get_user_attendance_records(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRecord>, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
            return Err(AppError::Forbidden);
        }
        self.repository
            .find_attendance_records(target_user_id, start_date, end_date)
            .await
            .map_err(|error| AppError::internal(format!("查询出勤记录失败: {error}")))
    }

    pub async fn get_user_attendance_ranking(
        &self,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRanking>, AppError> {
        self.repository
            .find_attendance_ranking(start_date, end_date)
            .await
            .map_err(|error| AppError::internal(format!("查询出勤排名失败: {error}")))
    }

    pub async fn get_user_attendance_ranking_for_user(
        &self,
        target_user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Option<UserAttendanceRanking>, AppError> {
        self.repository
            .find_attendance_ranking_for_user(target_user_id, start_date, end_date)
            .await
            .map_err(|error| AppError::internal(format!("查询用户出勤排名失败: {error}")))
    }

    /// 管理后台：分页查询球员列表（含所属球队）
    pub async fn list_players(
        &self,
        actor: &ActorContext,
        query: PlayerAdminListQuery<'_>,
    ) -> Result<PlayerListResult, AppError> {
        let mut scoped_query = query;
        scoped_query.admin_scope = Self::player_admin_scope(actor)?;
        self.repository
            .list_players_admin(scoped_query)
            .await
            .map_err(|error| AppError::internal(format!("查询球员列表失败: {error}")))
    }

    /// 管理后台：更新球员手机号
    pub async fn update_user_phone(
        &self,
        actor: &ActorContext,
        user_id: i64,
        phone: &str,
    ) -> Result<(), AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        self.repository
            .update_fields(
                user_id,
                crate::user::domain::UpdateUserFields {
                    phone_number: Some(phone),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| AppError::internal(format!("更新手机号失败: {e}")))
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

        self.repository
            .update_fields(
                actor.id,
                crate::user::domain::UpdateUserFields {
                    phone_number: Some(phone),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| AppError::internal(format!("绑定手机号失败: {e}")))?;

        self.get_current_user(actor).await
    }

    /// 管理后台：创建球员（由管理员手动录入）
    pub async fn admin_create_player(
        &self,
        actor: &ActorContext,
        real_name: String,
        nickname: Option<String>,
        phone_number: Option<String>,
    ) -> Result<User, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        if real_name.trim().is_empty() {
            return Err(AppError::Validation("真实姓名不能为空".to_string()));
        }
        let open_id = format!("admin_created_{}", uuid::Uuid::new_v4());
        let mut user = User::new(open_id, None, None, nickname, None);
        user.real_name = real_name.trim().to_string();
        user.phone_number = phone_number.unwrap_or_default();
        self.repository
            .create(&user)
            .await
            .map_err(|e| AppError::internal(format!("创建球员失败: {e}")))
    }

    /// 管理后台：获取单个球员详情（带球队归属 + 冻结信息）
    pub async fn get_player_detail(
        &self,
        actor: &ActorContext,
        user_id: i64,
    ) -> Result<crate::user::domain::PlayerWithTeams, AppError> {
        let admin_scope = Self::player_admin_scope(actor)?;
        let result = self
            .repository
            .list_players_admin(PlayerAdminListQuery {
                page: 1,
                page_size: 1_000_000,
                admin_scope,
                ..Default::default()
            })
            .await
            .map_err(|e| AppError::internal(format!("查询球员失败: {e}")))?;
        result
            .items
            .into_iter()
            .find(|p| p.id == user_id)
            .ok_or_else(|| AppError::NotFound("球员不存在".to_string()))
    }

    /// 管理后台：冻结球员
    pub async fn freeze_player(
        &self,
        actor: &ActorContext,
        user_id: i64,
        freeze_start: chrono::NaiveDateTime,
        freeze_end: Option<chrono::NaiveDateTime>,
    ) -> Result<User, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        self.repository
            .update_fields(
                user_id,
                crate::user::domain::UpdateUserFields {
                    status: Some(0_i8),
                    leave_start_time: Some(Some(freeze_start)),
                    leave_end_time: Some(freeze_end),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| AppError::internal(format!("冻结球员失败: {e}")))?;
        self.get_user_info(user_id).await
    }

    /// 管理后台：解冻球员
    pub async fn unfreeze_player(
        &self,
        actor: &ActorContext,
        user_id: i64,
    ) -> Result<User, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        self.repository
            .update_fields(
                user_id,
                crate::user::domain::UpdateUserFields {
                    status: Some(1_i8),
                    leave_start_time: Some(None),
                    leave_end_time: Some(None),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| AppError::internal(format!("解冻球员失败: {e}")))?;
        self.get_user_info(user_id).await
    }
}
