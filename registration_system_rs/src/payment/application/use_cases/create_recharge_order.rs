use crate::payment::application::openid_resolver::PaymentOpenIdResolver;
use crate::payment::application::order_no::generate_order_no;
use crate::payment::application::read_models::CreateRechargeOrderResult;
use crate::payment::domain::{DomainError, PaymentOrder, PaymentOrderStatus, PaymentOrderType};
use crate::payment::ports::{PaymentOrderCommandRepository, WxPayGateway};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use rust_decimal::Decimal;
use std::sync::Arc;

#[derive(Clone)]
pub struct CreateRechargeOrderUseCase {
    command_repository: Arc<dyn PaymentOrderCommandRepository>,
    wx_pay_gateway: Arc<dyn WxPayGateway>,
    openid_resolver: PaymentOpenIdResolver,
}

impl CreateRechargeOrderUseCase {
    pub fn new(
        command_repository: Arc<dyn PaymentOrderCommandRepository>,
        wx_pay_gateway: Arc<dyn WxPayGateway>,
        openid_resolver: PaymentOpenIdResolver,
    ) -> Self {
        Self {
            command_repository,
            wx_pay_gateway,
            openid_resolver,
        }
    }

    pub async fn execute(
        &self,
        actor: &ActorContext,
        amount: Decimal,
        openid: Option<&str>,
    ) -> Result<CreateRechargeOrderResult, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }
        if amount <= Decimal::ZERO {
            return Err(AppError::Validation("充值金额必须大于 0".to_string()));
        }

        let order_no = generate_order_no();
        let order = PaymentOrder {
            id: None,
            order_no: order_no.clone(),
            user_id: actor.id,
            amount,
            order_type: PaymentOrderType::Recharge,
            status: PaymentOrderStatus::Unpaid,
            prepay_id: None,
            transaction_id: None,
            description: Some("账户充值".to_string()),
            paid_at: None,
            cancelled_at: None,
            created_at: None,
            updated_at: None,
        };

        self.command_repository
            .create(&order)
            .await
            .map_err(|error| match error {
                DomainError::DuplicateOrder => AppError::Conflict("订单号已存在".to_string()),
                other => AppError::internal(format!("创建支付订单失败: {other}")),
            })?;

        let payment_openid = self.openid_resolver.resolve(actor, openid).await?;
        let (prepay_id, params) = self
            .wx_pay_gateway
            .create_mini_pay(&order_no, "账户充值", amount, &payment_openid)
            .await
            .map_err(|error| AppError::internal(format!("调用微信支付下单失败: {error}")))?;

        self.command_repository
            .update_payment_info(&order_no, &prepay_id, None)
            .await
            .map_err(|error| AppError::internal(format!("更新预支付信息失败: {error}")))?;

        Ok(CreateRechargeOrderResult { order_no, params })
    }
}
