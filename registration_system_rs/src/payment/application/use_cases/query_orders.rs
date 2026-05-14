use crate::payment::domain::{PaymentOrder, PaymentOrderStatus};
use crate::payment::ports::{PaymentOrderCommandRepository, PaymentOrderQueryRepository};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct QueryPaymentOrdersUseCase {
    command_repository: Arc<dyn PaymentOrderCommandRepository>,
    query_repository: Arc<dyn PaymentOrderQueryRepository>,
}

impl QueryPaymentOrdersUseCase {
    pub fn new(
        query_repository: Arc<dyn PaymentOrderQueryRepository>,
        command_repository: Arc<dyn PaymentOrderCommandRepository>,
    ) -> Self {
        Self {
            command_repository,
            query_repository,
        }
    }

    pub async fn get_order_status(
        &self,
        actor: &ActorContext,
        order_no: &str,
    ) -> Result<Option<PaymentOrder>, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        let order = self
            .query_repository
            .find_by_order_no(order_no)
            .await
            .map_err(|error| AppError::internal(format!("查询支付订单失败: {error}")))?;

        match order {
            Some(order) if order.user_id == actor.id => Ok(Some(order)),
            Some(_) => Err(AppError::Forbidden),
            None => Ok(None),
        }
    }

    pub async fn get_user_orders(
        &self,
        actor: &ActorContext,
        limit: i64,
    ) -> Result<Vec<PaymentOrder>, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }
        let safe_limit = limit.clamp(1, 100);

        self.query_repository
            .find_by_user_id(actor.id, safe_limit)
            .await
            .map_err(|error| AppError::internal(format!("查询支付订单列表失败: {error}")))
    }

    pub async fn cancel_order(
        &self,
        actor: &ActorContext,
        order_no: &str,
    ) -> Result<bool, AppError> {
        let order = self
            .get_order_status(actor, order_no)
            .await?
            .ok_or_else(|| AppError::NotFound("支付订单不存在".to_string()))?;

        if order.status != PaymentOrderStatus::Unpaid {
            return Ok(false);
        }

        self.command_repository
            .update_status(order_no, PaymentOrderStatus::Cancelled)
            .await
            .map_err(|error| AppError::internal(format!("取消支付订单失败: {error}")))?;

        Ok(true)
    }
}
