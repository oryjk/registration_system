use crate::billing::domain::{SettlementMode, SettlementParticipantScope};
use rust_decimal::Decimal;

#[derive(Debug, Clone)]
pub struct UpsertActivityFeeSnapshotCommand {
    pub activity_id: String,
    pub description: String,
    pub fee: Decimal,
    pub total: i32,
}

#[derive(Debug, Clone)]
pub struct RechargeCommand {
    pub user_id: i64,
    pub amount: Decimal,
    pub payment_method: String,
    pub transaction_no: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ActivityExpenseCommand {
    pub activity_id: String,
    pub total_amount: Decimal,
    pub user_ids: Vec<i64>,
    pub description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PenaltyCommand {
    pub user_id: i64,
    pub amount: Decimal,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct CalibrateBalanceCommand {
    pub user_id: i64,
    pub balance: Decimal,
    pub effective_time: chrono::NaiveDateTime,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct SettleActivityExpenseCommand {
    pub activity_id: String,
    pub total_amount: Decimal,
    pub mode: SettlementMode,
    pub participant_scope: SettlementParticipantScope,
    pub items: Vec<SettleActivityExpenseItemCommand>,
    pub description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SettleActivityExpenseItemCommand {
    pub user_id: i64,
    pub amount: Option<Decimal>,
}
