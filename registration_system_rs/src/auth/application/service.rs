use crate::auth::domain::{AdminUser, DomainError};
use crate::auth::ports::AdminUserRepository;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::shared::ports::TokenServicePort;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct AdminLoginResult {
    pub access_token: String,
    pub admin: AdminUser,
}

#[derive(Clone)]
pub struct AuthService {
    repository: Arc<dyn AdminUserRepository>,
    token_service: Arc<dyn TokenServicePort>,
}

impl AuthService {
    pub fn new(
        repository: Arc<dyn AdminUserRepository>,
        token_service: Arc<dyn TokenServicePort>,
    ) -> Self {
        Self {
            repository,
            token_service,
        }
    }

    pub async fn login(
        &self,
        username: &str,
        password: &str,
    ) -> Result<AdminLoginResult, AppError> {
        let admin = self
            .repository
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

        self.repository
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

    pub async fn verify_admin(&self, actor: &ActorContext) -> Result<AdminUser, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }

        self.repository
            .find_by_id(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询管理员失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("管理员不存在".to_string()))
    }

    pub async fn register_admin(
        &self,
        actor: &ActorContext,
        username: &str,
        password: &str,
        nickname: Option<&str>,
        is_super_admin: bool,
    ) -> Result<AdminUser, AppError> {
        let current_admin = self.verify_admin(actor).await?;
        if current_admin.is_super_admin != 1 {
            return Err(AppError::Forbidden);
        }
        if username.trim().is_empty() || password.trim().is_empty() {
            return Err(AppError::Validation("用户名和密码不能为空".to_string()));
        }
        if self
            .repository
            .find_by_username(username)
            .await
            .map_err(|error| AppError::internal(format!("检查管理员账号失败: {error}")))?
            .is_some()
        {
            return Err(AppError::Conflict("管理员用户名已存在".to_string()));
        }
        let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST)
            .map_err(|error| AppError::internal(format!("生成管理员密码失败: {error}")))?;
        self.repository
            .create(
                username,
                &password_hash,
                nickname.unwrap_or(username),
                is_super_admin,
            )
            .await
            .map_err(|e| match e {
                DomainError::AdminAlreadyExists => {
                    AppError::Conflict("管理员用户名已存在".to_string())
                }
                e => AppError::internal(format!("创建管理员失败: {e}")),
            })
    }

    pub async fn list_admins(&self, actor: &ActorContext) -> Result<Vec<AdminUser>, AppError> {
        self.verify_admin(actor).await?;
        self.repository
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
        let current_admin = self.verify_admin(actor).await?;
        if current_admin.is_super_admin != 1 {
            return Err(AppError::Forbidden);
        }
        self.repository
            .update_status(admin_id, status)
            .await
            .map_err(|error| AppError::internal(format!("更新管理员状态失败: {error}")))
    }

    pub async fn delete_admin(&self, actor: &ActorContext, admin_id: i64) -> Result<(), AppError> {
        let current_admin = self.verify_admin(actor).await?;
        if current_admin.is_super_admin != 1 {
            return Err(AppError::Forbidden);
        }
        if current_admin.id == admin_id {
            return Err(AppError::Validation("不能删除当前登录管理员".to_string()));
        }
        self.repository
            .delete(admin_id)
            .await
            .map_err(|error| AppError::internal(format!("删除管理员失败: {error}")))
    }
}
