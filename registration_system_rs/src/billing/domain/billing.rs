use chrono::{NaiveDate, NaiveDateTime};
use rust_decimal::Decimal;

#[derive(Debug, Clone)]
pub struct UserAccount {
    pub id: i64,
    pub user_id: i64,
    pub balance: Decimal,
    pub total_recharge: Decimal,
    pub total_expense: Decimal,
    pub total_penalty: Decimal,
    pub last_updated: NaiveDateTime,
    pub version: i32,
    pub status: i8,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct ActivityFeeSnapshot {
    pub id: i64,
    pub activity_id: String,
    pub description: String,
    pub fee: Decimal,
    pub total: i32,
    pub activity_holding_time: Option<NaiveDateTime>,
    pub create_time: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct UserBillingRecord {
    pub id: i64,
    pub user_id: i64,
    pub activity_id: String,
    pub fee: Decimal,
    pub billing_type: String,
    pub description: Option<String>,
    pub billing_date: NaiveDate,
    pub status: i8,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct TransactionRecord {
    pub id: i64,
    pub user_id: i64,
    pub record_type: String,
    pub amount: Decimal,
    pub description: Option<String>,
    pub activity_id: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct BalanceCalibrationRecord {
    pub id: i64,
    pub user_id: i64,
    pub user_name: Option<String>,
    pub target_balance: Decimal,
    pub effective_time: NaiveDateTime,
    pub reason: String,
    pub created_by: Option<i64>,
    pub created_by_name: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct BillingFlowRecord {
    pub id: String,
    pub record_type: String,
    pub type_name: String,
    pub amount: Decimal,
    pub description: String,
    pub activity_id: Option<String>,
    pub created_at: NaiveDateTime,
    pub balance: Decimal,
}

#[derive(Debug, Clone)]
pub struct BillingFlowResult {
    pub records: Vec<BillingFlowRecord>,
    pub final_balance: Decimal,
}

#[derive(Debug, Clone)]
pub struct ActivityBillingSummary {
    pub month_key: String,
    pub activity_id: String,
    pub activity_name: String,
    pub holding_date: NaiveDateTime,
    pub location: String,
    pub total: Option<i32>,
    pub fee: Option<Decimal>,
    pub user_id: Option<i64>,
    pub stand: Option<i8>,
    pub registration_count: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct ActivitySettlementSummary {
    pub activity_id: String,
    pub mode: Option<SettlementMode>,
    pub participant_scope: Option<SettlementParticipantScope>,
    pub description: Option<String>,
    pub total_amount: Option<Decimal>,
    pub aa_fee: Option<Decimal>,
    pub attending_user_count: i32,
    pub settled_user_count: i32,
    pub settled: bool,
    pub settled_at: Option<NaiveDateTime>,
    pub current_batch_no: Option<i32>,
    pub history: Vec<ActivitySettlementBatch>,
    pub items: Vec<ActivitySettlementItem>,
}

#[derive(Debug, Clone)]
pub struct ActivitySettlementItem {
    pub user_id: i64,
    pub user_name: Option<String>,
    pub fee: Option<Decimal>,
    pub billed: bool,
    pub billing_id: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct ActivitySettlementBatch {
    pub batch_no: i32,
    pub operation_type: String,
    pub mode: SettlementMode,
    pub participant_scope: SettlementParticipantScope,
    pub reversal_of_batch_no: Option<i32>,
    pub description: String,
    pub total_amount: Decimal,
    pub aa_fee: Decimal,
    pub user_count: i32,
    pub created_by_admin_id: Option<i64>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettlementMode {
    Aa,
    Manual,
}

impl SettlementMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Aa => "aa",
            Self::Manual => "manual",
        }
    }
}

impl From<&str> for SettlementMode {
    fn from(value: &str) -> Self {
        match value {
            "manual" => Self::Manual,
            _ => Self::Aa,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettlementParticipantScope {
    RegisteredAttendees,
    CustomUsers,
}

impl SettlementParticipantScope {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::RegisteredAttendees => "registered_attendees",
            Self::CustomUsers => "custom_users",
        }
    }
}

impl From<&str> for SettlementParticipantScope {
    fn from(value: &str) -> Self {
        match value {
            "custom_users" => Self::CustomUsers,
            _ => Self::RegisteredAttendees,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PenaltyCandidate {
    pub user_id: i64,
    pub amount: Decimal,
    pub reason: String,
}
