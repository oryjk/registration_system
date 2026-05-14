use chrono::NaiveDateTime;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentOrderStatus {
    Unpaid,
    Paid,
    Cancelled,
    Refunded,
}

impl PaymentOrderStatus {
    pub fn as_db_str(self) -> &'static str {
        match self {
            Self::Unpaid => "pending",
            Self::Paid => "paid",
            Self::Cancelled => "cancelled",
            Self::Refunded => "refunded",
        }
    }

    pub fn from_db_str(value: &str) -> Self {
        match value {
            "paid" => Self::Paid,
            "cancelled" => Self::Cancelled,
            "refunded" => Self::Refunded,
            _ => Self::Unpaid,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentOrderType {
    Recharge,
    Activity,
    TeamMembership,
}

impl PaymentOrderType {
    pub fn as_db_str(self) -> &'static str {
        match self {
            Self::Recharge => "recharge",
            Self::Activity => "activity",
            Self::TeamMembership => "team_membership",
        }
    }

    pub fn from_db_str(value: &str) -> Self {
        match value {
            "activity" => Self::Activity,
            "team_membership" => Self::TeamMembership,
            _ => Self::Recharge,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PaymentOrder {
    pub id: Option<i64>,
    pub order_no: String,
    pub user_id: i64,
    pub amount: Decimal,
    pub order_type: PaymentOrderType,
    pub status: PaymentOrderStatus,
    pub prepay_id: Option<String>,
    pub transaction_id: Option<String>,
    pub description: Option<String>,
    pub paid_at: Option<NaiveDateTime>,
    pub cancelled_at: Option<NaiveDateTime>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
}

#[derive(Debug, Clone)]
pub struct WxMiniPaymentParams {
    pub time_stamp: String,
    pub nonce_str: String,
    pub package: String,
    pub sign_type: String,
    pub pay_sign: String,
}

#[derive(Debug, Clone)]
pub struct PaymentQueryResult {
    pub paid: bool,
    pub transaction_id: Option<String>,
    pub trade_state: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TeamMembershipPaymentOrder {
    pub order_no: String,
    pub team_id: i64,
    pub user_id: i64,
    pub months: i32,
    pub credit_delta: i32,
    pub amount: Decimal,
    pub note: Option<String>,
    pub applied_at: Option<NaiveDateTime>,
}
