use crate::payment::domain::{PaymentOrder, PaymentOrderStatus, PaymentOrderType};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateRechargeOrderRequest {
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub openid: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTeamMembershipOrderRequest {
    pub team_id: String,
    pub months: i32,
    pub openid: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CancelOrderRequest {
    pub order_no: String,
}

/// 本地 DTO 枚举，不复用 domain 枚举
#[derive(Debug, Clone, Copy, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum PaymentOrderStatusDto {
    Unpaid,
    Paid,
    Cancelled,
    Refunded,
}

impl From<PaymentOrderStatus> for PaymentOrderStatusDto {
    fn from(value: PaymentOrderStatus) -> Self {
        match value {
            PaymentOrderStatus::Unpaid => Self::Unpaid,
            PaymentOrderStatus::Paid => Self::Paid,
            PaymentOrderStatus::Cancelled => Self::Cancelled,
            PaymentOrderStatus::Refunded => Self::Refunded,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum PaymentOrderTypeDto {
    Recharge,
    Activity,
    TeamMembership,
}

impl From<PaymentOrderType> for PaymentOrderTypeDto {
    fn from(value: PaymentOrderType) -> Self {
        match value {
            PaymentOrderType::Recharge => Self::Recharge,
            PaymentOrderType::Activity => Self::Activity,
            PaymentOrderType::TeamMembership => Self::TeamMembership,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaymentOrderDto {
    pub order_no: String,
    pub user_id: i64,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub order_type: PaymentOrderTypeDto,
    pub status: PaymentOrderStatusDto,
    pub prepay_id: Option<String>,
    pub transaction_id: Option<String>,
    pub description: Option<String>,
}

impl From<PaymentOrder> for PaymentOrderDto {
    fn from(value: PaymentOrder) -> Self {
        Self {
            order_no: value.order_no,
            user_id: value.user_id,
            amount: value.amount,
            order_type: PaymentOrderTypeDto::from(value.order_type),
            status: PaymentOrderStatusDto::from(value.status),
            prepay_id: value.prepay_id,
            transaction_id: value.transaction_id,
            description: value.description,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateRechargeOrderResultDto {
    pub order_no: String,
    pub params: WxMiniPaymentParamsDto,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateTeamMembershipOrderResultDto {
    pub order_no: String,
    pub params: WxMiniPaymentParamsDto,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WxMiniPaymentParamsDto {
    pub time_stamp: String,
    pub nonce_str: String,
    pub package: String,
    pub sign_type: String,
    pub pay_sign: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OrderStatusDto {
    pub status: Option<PaymentOrderStatusDto>,
    pub order: Option<PaymentOrderDto>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SyncOrderStatusDto {
    pub paid: bool,
    pub status: &'static str,
    pub trade_state: Option<String>,
    pub transaction_id: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CancelOrderResultDto {
    pub success: bool,
    pub message: &'static str,
}
