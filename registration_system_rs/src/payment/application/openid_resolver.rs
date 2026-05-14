use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::user::ports::UserQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct PaymentOpenIdResolver {
    user_repository: Arc<dyn UserQueryRepository>,
}

impl PaymentOpenIdResolver {
    pub fn new(user_repository: Arc<dyn UserQueryRepository>) -> Self {
        Self { user_repository }
    }

    pub async fn resolve(
        &self,
        actor: &ActorContext,
        provided_openid: Option<&str>,
    ) -> Result<String, AppError> {
        if let Some(openid) = provided_openid
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Ok(openid.to_string());
        }

        let user = self
            .user_repository
            .find_by_id(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询支付用户失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))?;
        Ok(user.open_id)
    }
}
