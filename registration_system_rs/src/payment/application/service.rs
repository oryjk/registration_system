use crate::payment::domain::{
    DomainError, PaymentOrder, PaymentOrderStatus, PaymentOrderType, PaymentQueryResult,
    TeamMembershipPaymentOrder, WxMiniPaymentParams,
};
use crate::payment::ports::{
    PaymentBillingPort, PaymentOrderRepository, TeamMembershipSettlement, WxPayGateway,
};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::team::domain::{membership_credit_delta, membership_price};
use crate::team::ports::TeamRepository;
use crate::user::ports::UserRepository;
use chrono::Utc;
use rust_decimal::Decimal;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct CreateRechargeOrderResult {
    pub order_no: String,
    pub params: WxMiniPaymentParams,
}

#[derive(Debug, Clone)]
pub struct CreateTeamMembershipOrderCommand {
    pub team_id: String,
    pub months: i32,
    pub openid: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CreateTeamMembershipOrderResult {
    pub order_no: String,
    pub params: WxMiniPaymentParams,
}

#[derive(Clone)]
pub struct PaymentService {
    repository: Arc<dyn PaymentOrderRepository>,
    billing_port: Arc<dyn PaymentBillingPort>,
    wx_pay_gateway: Arc<dyn WxPayGateway>,
    team_repository: Arc<dyn TeamRepository>,
    user_repository: Arc<dyn UserRepository>,
}

impl PaymentService {
    pub fn new(
        repository: Arc<dyn PaymentOrderRepository>,
        billing_port: Arc<dyn PaymentBillingPort>,
        wx_pay_gateway: Arc<dyn WxPayGateway>,
        team_repository: Arc<dyn TeamRepository>,
        user_repository: Arc<dyn UserRepository>,
    ) -> Self {
        Self {
            repository,
            billing_port,
            wx_pay_gateway,
            team_repository,
            user_repository,
        }
    }

    async fn resolve_actor_open_id(
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

    pub async fn create_recharge_order(
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

        let order_no = Self::generate_order_no();
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

        self.repository.create(&order).await.map_err(|e| match e {
            DomainError::DuplicateOrder => AppError::Conflict("订单号已存在".to_string()),
            e => AppError::internal(format!("创建支付订单失败: {e}")),
        })?;

        let payment_openid = self.resolve_actor_open_id(actor, openid).await?;
        let (prepay_id, params) = self
            .wx_pay_gateway
            .create_mini_pay(&order_no, "账户充值", amount, &payment_openid)
            .await
            .map_err(|error| AppError::internal(format!("调用微信支付下单失败: {error}")))?;

        self.repository
            .update_payment_info(&order_no, &prepay_id, None)
            .await
            .map_err(|error| AppError::internal(format!("更新预支付信息失败: {error}")))?;

        Ok(CreateRechargeOrderResult { order_no, params })
    }

    pub async fn create_team_membership_order(
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
            .find_by_id(&command.team_id)
            .await
            .map_err(|error| AppError::internal(format!("查询球队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("球队不存在".to_string()))?;

        if team.captain_id != Some(actor.id) {
            return Err(AppError::Forbidden);
        }

        let order_no = Self::generate_order_no();
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

        self.repository.create(&order).await.map_err(|e| match e {
            DomainError::DuplicateOrder => AppError::Conflict("订单号已存在".to_string()),
            e => AppError::internal(format!("创建球队会员订单失败: {e}")),
        })?;

        self.repository
            .create_team_membership_order(&TeamMembershipPaymentOrder {
                order_no: order_no.clone(),
                team_id: command.team_id.clone(),
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
            .resolve_actor_open_id(actor, command.openid.as_deref())
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

        self.repository
            .update_payment_info(&order_no, &prepay_id, None)
            .await
            .map_err(|error| AppError::internal(format!("更新预支付信息失败: {error}")))?;

        Ok(CreateTeamMembershipOrderResult { order_no, params })
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
            .repository
            .find_by_order_no(order_no)
            .await
            .map_err(|error| AppError::internal(format!("查询支付订单失败: {error}")))?;

        match order {
            Some(order) if order.user_id == actor.id => Ok(Some(order)),
            Some(_) => Err(AppError::Forbidden),
            None => Ok(None),
        }
    }

    pub async fn sync_order_status(
        &self,
        actor: &ActorContext,
        order_no: &str,
    ) -> Result<PaymentQueryResult, AppError> {
        let order = self
            .get_order_status(actor, order_no)
            .await?
            .ok_or_else(|| AppError::NotFound("支付订单不存在".to_string()))?;

        if order.status == PaymentOrderStatus::Paid {
            return Ok(PaymentQueryResult {
                paid: true,
                transaction_id: order.transaction_id,
                trade_state: Some("SUCCESS".to_string()),
            });
        }

        let result = self
            .wx_pay_gateway
            .query_order(order_no)
            .await
            .map_err(|error| AppError::internal(format!("查询微信支付状态失败: {error}")))?;

        if result.paid {
            self.handle_paid_order(
                order_no,
                result
                    .transaction_id
                    .as_deref()
                    .unwrap_or("mock-transaction-id"),
            )
            .await?;
        }

        Ok(result)
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

        self.repository
            .find_by_user_id(actor.id, safe_limit)
            .await
            .map_err(|error| AppError::internal(format!("查询支付订单列表失败: {error}")))
    }

    pub async fn handle_wx_pay_notify(
        &self,
        order_no: &str,
        transaction_id: &str,
        total_fee: i64,
    ) -> Result<bool, AppError> {
        let order = self
            .repository
            .find_by_order_no(order_no)
            .await
            .map_err(|error| AppError::internal(format!("查询支付订单失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("支付订单不存在".to_string()))?;

        if order.status == PaymentOrderStatus::Paid {
            return Ok(true);
        }

        let paid_amount = Decimal::new(total_fee, 2);
        if paid_amount != order.amount {
            return Err(AppError::Validation("支付金额与订单金额不一致".to_string()));
        }

        self.handle_paid_order(order_no, transaction_id).await?;
        Ok(true)
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

        self.repository
            .update_status(order_no, PaymentOrderStatus::Cancelled)
            .await
            .map_err(|error| AppError::internal(format!("取消支付订单失败: {error}")))?;

        Ok(true)
    }

    async fn handle_paid_order(
        &self,
        order_no: &str,
        transaction_id: &str,
    ) -> Result<(), AppError> {
        let order = self
            .repository
            .find_by_order_no(order_no)
            .await
            .map_err(|error| AppError::internal(format!("查询支付订单失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("支付订单不存在".to_string()))?;

        self.repository
            .mark_as_paid(order_no, transaction_id, Utc::now().naive_utc())
            .await
            .map_err(|error| AppError::internal(format!("标记支付订单已支付失败: {error}")))?;

        if order.order_type == PaymentOrderType::Recharge {
            self.billing_port
                .apply_recharge(order.user_id, order.amount, transaction_id, "微信充值")
                .await
                .map_err(|error| AppError::internal(format!("充值入账失败: {error}")))?;
        } else if order.order_type == PaymentOrderType::TeamMembership {
            let membership_order = self
                .repository
                .find_team_membership_order(order_no)
                .await
                .map_err(|error| AppError::internal(format!("查询球队会员订单失败: {error}")))?
                .ok_or_else(|| AppError::NotFound("球队会员订单不存在".to_string()))?;
            self.billing_port
                .apply_team_membership_order(TeamMembershipSettlement {
                    order_no: &membership_order.order_no,
                    team_id: &membership_order.team_id,
                    user_id: membership_order.user_id,
                    months: membership_order.months,
                    amount: membership_order.amount,
                    credit_delta: membership_order.credit_delta,
                    transaction_id,
                    note: membership_order.note.as_deref(),
                })
                .await
                .map_err(|error| AppError::internal(format!("球队会员入账失败: {error}")))?;
        }

        Ok(())
    }

    fn generate_order_no() -> String {
        let timestamp = chrono::Utc::now().timestamp_millis();
        let suffix: u16 = rand::random::<u16>() % 10000;
        format!("{timestamp}{suffix:04}")
    }
}
