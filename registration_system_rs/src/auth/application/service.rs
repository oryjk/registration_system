use crate::auth::application::commands::RegisterAdminCommand;
use crate::auth::application::permissions::AdminPermissionChecker;
use crate::auth::application::read_models::AdminLoginResult;
use crate::auth::application::use_cases::{
    AdminLoginUseCase, ManageAdminUseCase, VerifyAdminUseCase,
};
use crate::auth::domain::AdminUser;
use crate::auth::ports::{AdminUserCommandRepository, AdminUserQueryRepository};
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::shared::ports::TokenServicePort;
use std::sync::Arc;

#[derive(Clone)]
pub struct AuthService {
    login_use_case: AdminLoginUseCase,
    verify_admin_use_case: VerifyAdminUseCase,
    manage_admin_use_case: ManageAdminUseCase,
}

impl AuthService {
    pub fn new(
        query_repository: Arc<dyn AdminUserQueryRepository>,
        command_repository: Arc<dyn AdminUserCommandRepository>,
        token_service: Arc<dyn TokenServicePort>,
    ) -> Self {
        let permission_checker = AdminPermissionChecker::new(query_repository.clone());
        Self {
            login_use_case: AdminLoginUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
                token_service,
            ),
            verify_admin_use_case: VerifyAdminUseCase::new(permission_checker.clone()),
            manage_admin_use_case: ManageAdminUseCase::new(
                query_repository,
                command_repository,
                permission_checker,
            ),
        }
    }

    pub async fn login(
        &self,
        username: &str,
        password: &str,
    ) -> Result<AdminLoginResult, AppError> {
        self.login_use_case.execute(username, password).await
    }

    pub async fn verify_admin(&self, actor: &ActorContext) -> Result<AdminUser, AppError> {
        self.verify_admin_use_case.execute(actor).await
    }

    pub async fn register_admin(
        &self,
        actor: &ActorContext,
        username: &str,
        password: &str,
        nickname: Option<&str>,
        is_super_admin: bool,
    ) -> Result<AdminUser, AppError> {
        self.manage_admin_use_case
            .register_admin(
                actor,
                RegisterAdminCommand {
                    username,
                    password,
                    nickname,
                    is_super_admin,
                },
            )
            .await
    }

    pub async fn list_admins(&self, actor: &ActorContext) -> Result<Vec<AdminUser>, AppError> {
        self.manage_admin_use_case.list_admins(actor).await
    }

    pub async fn update_admin_status(
        &self,
        actor: &ActorContext,
        admin_id: i64,
        status: i8,
    ) -> Result<(), AppError> {
        self.manage_admin_use_case
            .update_admin_status(actor, admin_id, status)
            .await
    }

    pub async fn delete_admin(&self, actor: &ActorContext, admin_id: i64) -> Result<(), AppError> {
        self.manage_admin_use_case
            .delete_admin(actor, admin_id)
            .await
    }
}
