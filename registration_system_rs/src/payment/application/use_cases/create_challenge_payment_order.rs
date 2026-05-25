use crate::payment::application::commands::CreateChallengePaymentOrderCommand;
use crate::payment::application::openid_resolver::PaymentOpenIdResolver;
use crate::payment::application::order_no::generate_order_no;
use crate::payment::application::read_models::CreateChallengePaymentOrderResult;
use crate::payment::domain::{DomainError, PaymentOrder, PaymentOrderStatus, PaymentOrderType};
use crate::payment::ports::{
    ActivityPaymentAccessPort, PaymentOrderCommandRepository, WxPayGateway,
};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use rust_decimal::Decimal;
use std::sync::Arc;

#[derive(Clone)]
pub struct CreateChallengePaymentOrderUseCase {
    command_repository: Arc<dyn PaymentOrderCommandRepository>,
    activity_payment_access_port: Arc<dyn ActivityPaymentAccessPort>,
    wx_pay_gateway: Arc<dyn WxPayGateway>,
    openid_resolver: PaymentOpenIdResolver,
}

impl CreateChallengePaymentOrderUseCase {
    pub fn new(
        command_repository: Arc<dyn PaymentOrderCommandRepository>,
        activity_payment_access_port: Arc<dyn ActivityPaymentAccessPort>,
        wx_pay_gateway: Arc<dyn WxPayGateway>,
        openid_resolver: PaymentOpenIdResolver,
    ) -> Self {
        Self {
            command_repository,
            activity_payment_access_port,
            wx_pay_gateway,
            openid_resolver,
        }
    }

    pub async fn execute(
        &self,
        actor: &ActorContext,
        command: CreateChallengePaymentOrderCommand,
    ) -> Result<CreateChallengePaymentOrderResult, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        let acceptance = self
            .activity_payment_access_port
            .find_individual_acceptance(&command.challenge_id, actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询散人报名支付记录失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("散人报名记录不存在".to_string()))?;

        if acceptance.payment_status != "unpaid" {
            return Err(AppError::Conflict("当前报名无需支付".to_string()));
        }
        if acceptance.amount <= Decimal::ZERO {
            return Err(AppError::Validation("当前散人报名费用无需支付".to_string()));
        }
        if acceptance
            .payment_deadline_at
            .is_some_and(|deadline| deadline <= chrono::Utc::now().naive_utc())
        {
            return Err(AppError::Conflict("支付时间已截止".to_string()));
        }

        let order_no = generate_order_no();
        let description = format!("散人报名：{}", acceptance.title);
        let order = PaymentOrder {
            id: None,
            order_no: order_no.clone(),
            user_id: actor.id,
            amount: acceptance.amount,
            order_type: PaymentOrderType::Activity,
            status: PaymentOrderStatus::Unpaid,
            prepay_id: None,
            transaction_id: None,
            description: Some(description.clone()),
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

        self.activity_payment_access_port
            .attach_payment_order(&acceptance.challenge_id, acceptance.user_id, &order_no)
            .await
            .map_err(|error| AppError::internal(format!("关联散人报名支付订单失败: {error}")))?;

        let payment_openid = self
            .openid_resolver
            .resolve(actor, command.openid.as_deref())
            .await?;
        let (prepay_id, params) = self
            .wx_pay_gateway
            .create_mini_pay(&order_no, &description, acceptance.amount, &payment_openid)
            .await
            .map_err(|error| AppError::internal(format!("调用微信支付下单失败: {error}")))?;

        self.command_repository
            .update_payment_info(&order_no, &prepay_id, None)
            .await
            .map_err(|error| AppError::internal(format!("更新预支付信息失败: {error}")))?;

        Ok(CreateChallengePaymentOrderResult { order_no, params })
    }
}
