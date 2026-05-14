use crate::auth::application::permissions::AdminPermissionChecker;
use crate::auth::domain::AdminUser;
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;

#[derive(Clone)]
pub struct VerifyAdminUseCase {
    permission_checker: AdminPermissionChecker,
}

impl VerifyAdminUseCase {
    pub fn new(permission_checker: AdminPermissionChecker) -> Self {
        Self { permission_checker }
    }

    pub async fn execute(&self, actor: &ActorContext) -> Result<AdminUser, AppError> {
        self.permission_checker.verify_admin(actor).await
    }
}
