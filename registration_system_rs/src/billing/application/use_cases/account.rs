use crate::billing::domain::{BillingFlowResult, TransactionRecord, UserAccount};
use crate::billing::ports::BillingQueryRepository;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct BillingAccountUseCase {
    query_repository: Arc<dyn BillingQueryRepository>,
}

impl BillingAccountUseCase {
    pub fn new(query_repository: Arc<dyn BillingQueryRepository>) -> Self {
        Self { query_repository }
    }

    pub async fn get_my_balance(
        &self,
        actor: &ActorContext,
    ) -> Result<Option<UserAccount>, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        self.query_repository
            .get_user_account(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询账户余额失败: {error}")))
    }

    pub async fn get_user_balance(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<Option<UserAccount>, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
            return Err(AppError::Forbidden);
        }
        self.query_repository
            .get_user_account(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户余额失败: {error}")))
    }

    pub async fn list_my_billings(
        &self,
        actor: &ActorContext,
    ) -> Result<BillingFlowResult, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        self.query_repository
            .get_user_billing_flow(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询个人账单流水失败: {error}")))
    }

    pub async fn list_transactions(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
        limit: i64,
    ) -> Result<Vec<TransactionRecord>, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
            return Err(AppError::Forbidden);
        }
        self.query_repository
            .list_transactions(target_user_id, limit)
            .await
            .map_err(|error| AppError::internal(format!("查询交易记录失败: {error}")))
    }

    pub async fn get_user_billing_flow(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<BillingFlowResult, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
            return Err(AppError::Forbidden);
        }
        self.query_repository
            .get_user_billing_flow(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户账单流水失败: {error}")))
    }
}
