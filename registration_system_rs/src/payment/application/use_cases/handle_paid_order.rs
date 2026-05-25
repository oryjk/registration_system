use crate::payment::domain::{
    PaymentOrder, PaymentOrderStatus, PaymentOrderType, PaymentQueryResult,
};
use crate::payment::ports::{
    ActivityPaymentSettlement, PaymentOrderCommandRepository, PaymentOrderQueryRepository,
    PaymentSettlementPort, RechargePaymentSettlement, TeamMembershipPaymentSettlement,
    WxPayGateway,
};
use crate::shared::error::AppError;
use chrono::Utc;
use rust_decimal::Decimal;
use std::sync::Arc;

#[derive(Clone)]
pub struct HandlePaidOrderUseCase {
    command_repository: Arc<dyn PaymentOrderCommandRepository>,
    query_repository: Arc<dyn PaymentOrderQueryRepository>,
    settlement_port: Arc<dyn PaymentSettlementPort>,
    wx_pay_gateway: Arc<dyn WxPayGateway>,
}

impl HandlePaidOrderUseCase {
    pub fn new(
        query_repository: Arc<dyn PaymentOrderQueryRepository>,
        command_repository: Arc<dyn PaymentOrderCommandRepository>,
        settlement_port: Arc<dyn PaymentSettlementPort>,
        wx_pay_gateway: Arc<dyn WxPayGateway>,
    ) -> Self {
        Self {
            command_repository,
            query_repository,
            settlement_port,
            wx_pay_gateway,
        }
    }

    pub async fn sync_order_status(&self, order_no: &str) -> Result<PaymentQueryResult, AppError> {
        let order = self
            .query_repository
            .find_by_order_no(order_no)
            .await
            .map_err(|error| AppError::internal(format!("查询支付订单失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("支付订单不存在".to_string()))?;

        if order.status == PaymentOrderStatus::Paid {
            let transaction_id = order.transaction_id.clone().ok_or_else(|| {
                AppError::internal("支付订单已支付但缺少 transaction_id".to_string())
            })?;

            self.handle_paid_order(&order, &transaction_id).await?;
            return Ok(PaymentQueryResult {
                paid: true,
                transaction_id: Some(transaction_id),
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
                &order,
                result
                    .transaction_id
                    .as_deref()
                    .unwrap_or("mock-transaction-id"),
            )
            .await?;
        }

        Ok(result)
    }

    pub async fn handle_wx_pay_notify(
        &self,
        order_no: &str,
        transaction_id: &str,
        total_fee: i64,
    ) -> Result<bool, AppError> {
        let order = self
            .query_repository
            .find_by_order_no(order_no)
            .await
            .map_err(|error| AppError::internal(format!("查询支付订单失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("支付订单不存在".to_string()))?;

        let paid_amount = Decimal::new(total_fee, 2);
        if paid_amount != order.amount {
            return Err(AppError::Validation("支付金额与订单金额不一致".to_string()));
        }

        let effective_transaction_id = if order.status == PaymentOrderStatus::Paid {
            order.transaction_id.as_deref().unwrap_or(transaction_id)
        } else {
            transaction_id
        };

        self.handle_paid_order(&order, effective_transaction_id)
            .await?;
        Ok(true)
    }

    async fn handle_paid_order(
        &self,
        order: &PaymentOrder,
        transaction_id: &str,
    ) -> Result<(), AppError> {
        if order.status != PaymentOrderStatus::Paid {
            self.command_repository
                .mark_as_paid(&order.order_no, transaction_id, Utc::now().naive_utc())
                .await
                .map_err(|error| AppError::internal(format!("标记支付订单已支付失败: {error}")))?;
        }

        if order.order_type == PaymentOrderType::Recharge {
            self.settlement_port
                .settle_recharge_payment(RechargePaymentSettlement {
                    order_no: &order.order_no,
                    user_id: order.user_id,
                    amount: order.amount,
                    transaction_id,
                    description: "微信充值",
                })
                .await
                .map_err(|error| AppError::internal(format!("充值入账失败: {error}")))?;
        } else if order.order_type == PaymentOrderType::TeamMembership {
            let membership_order = self
                .query_repository
                .find_team_membership_order(&order.order_no)
                .await
                .map_err(|error| AppError::internal(format!("查询球队会员订单失败: {error}")))?
                .ok_or_else(|| AppError::NotFound("球队会员订单不存在".to_string()))?;
            self.settlement_port
                .settle_team_membership_payment(TeamMembershipPaymentSettlement {
                    order_no: &membership_order.order_no,
                    team_id: membership_order.team_id,
                    user_id: membership_order.user_id,
                    months: membership_order.months,
                    amount: membership_order.amount,
                    credit_delta: membership_order.credit_delta,
                    transaction_id,
                    note: membership_order.note.as_deref(),
                })
                .await
                .map_err(|error| AppError::internal(format!("球队会员入账失败: {error}")))?;
        } else if order.order_type == PaymentOrderType::Activity {
            self.settlement_port
                .settle_activity_payment(ActivityPaymentSettlement {
                    order_no: &order.order_no,
                    user_id: order.user_id,
                    transaction_id,
                })
                .await
                .map_err(|error| AppError::internal(format!("活动支付回写失败: {error}")))?;
        }

        Ok(())
    }
}
