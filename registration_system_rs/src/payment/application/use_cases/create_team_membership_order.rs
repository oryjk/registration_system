use crate::payment::application::commands::CreateTeamMembershipOrderCommand;
use crate::payment::application::openid_resolver::PaymentOpenIdResolver;
use crate::payment::application::order_no::generate_order_no;
use crate::payment::application::read_models::CreateTeamMembershipOrderResult;
use crate::payment::domain::{
    DomainError, PaymentOrder, PaymentOrderStatus, PaymentOrderType, TeamMembershipPaymentOrder,
};
use crate::payment::ports::{PaymentOrderCommandRepository, WxPayGateway};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::team::domain::{membership_credit_delta, membership_price};
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct CreateTeamMembershipOrderUseCase {
    command_repository: Arc<dyn PaymentOrderCommandRepository>,
    team_repository: Arc<dyn TeamQueryRepository>,
    wx_pay_gateway: Arc<dyn WxPayGateway>,
    openid_resolver: PaymentOpenIdResolver,
}

impl CreateTeamMembershipOrderUseCase {
    pub fn new(
        command_repository: Arc<dyn PaymentOrderCommandRepository>,
        team_repository: Arc<dyn TeamQueryRepository>,
        wx_pay_gateway: Arc<dyn WxPayGateway>,
        openid_resolver: PaymentOpenIdResolver,
    ) -> Self {
        Self {
            command_repository,
            team_repository,
            wx_pay_gateway,
            openid_resolver,
        }
    }

    pub async fn execute(
        &self,
        actor: &ActorContext,
        command: CreateTeamMembershipOrderCommand,
    ) -> Result<CreateTeamMembershipOrderResult, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        let Some(amount) = membership_price(command.months) else {
            return Err(AppError::Validation("会员月份必须大于 0".to_string()));
        };
        let Some(credit_delta) = membership_credit_delta(command.months) else {
            return Err(AppError::Validation("信用修复分值计算失败".to_string()));
        };

        let team = self
            .team_repository
            .find_by_id(command.team_id)
            .await
            .map_err(|error| AppError::internal(format!("查询球队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("球队不存在".to_string()))?;

        if team.captain_id != Some(actor.id) {
            return Err(AppError::Forbidden);
        }

        let order_no = generate_order_no();
        let order = PaymentOrder {
            id: None,
            order_no: order_no.clone(),
            user_id: actor.id,
            amount,
            order_type: PaymentOrderType::TeamMembership,
            status: PaymentOrderStatus::Unpaid,
            prepay_id: None,
            transaction_id: None,
            description: Some(format!("{} 球队会员 {} 个月", team.name, command.months)),
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
                other => AppError::internal(format!("创建球队会员订单失败: {other}")),
            })?;

        self.command_repository
            .create_team_membership_order(&TeamMembershipPaymentOrder {
                order_no: order_no.clone(),
                team_id: command.team_id,
                user_id: actor.id,
                months: command.months,
                credit_delta,
                amount,
                note: command.note.clone(),
                applied_at: None,
            })
            .await
            .map_err(|error| AppError::internal(format!("保存球队会员订单失败: {error}")))?;

        let payment_openid = self
            .openid_resolver
            .resolve(actor, command.openid.as_deref())
            .await?;
        let (prepay_id, params) = self
            .wx_pay_gateway
            .create_mini_pay(
                &order_no,
                order.description.as_deref().unwrap_or("球队会员"),
                amount,
                &payment_openid,
            )
            .await
            .map_err(|error| AppError::internal(format!("调用微信支付下单失败: {error}")))?;

        self.command_repository
            .update_payment_info(&order_no, &prepay_id, None)
            .await
            .map_err(|error| AppError::internal(format!("更新预支付信息失败: {error}")))?;

        Ok(CreateTeamMembershipOrderResult { order_no, params })
    }
}
