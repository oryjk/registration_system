use crate::billing::domain::{ActivityBillingSummary, UserAccount};
use crate::billing::ports::BillingQueryRepository;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct BillingReportUseCase {
    query_repository: Arc<dyn BillingQueryRepository>,
}

impl BillingReportUseCase {
    pub fn new(query_repository: Arc<dyn BillingQueryRepository>) -> Self {
        Self { query_repository }
    }

    pub async fn get_activities_billing(
        &self,
        actor: &ActorContext,
    ) -> Result<Vec<ActivityBillingSummary>, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        self.query_repository
            .list_activities_billing()
            .await
            .map_err(|error| AppError::internal(format!("查询活动账单失败: {error}")))
    }

    pub async fn get_users_billing(
        &self,
        actor: &ActorContext,
    ) -> Result<Vec<UserAccount>, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        self.query_repository
            .list_users_billing()
            .await
            .map_err(|error| AppError::internal(format!("查询用户账单汇总失败: {error}")))
    }
}
