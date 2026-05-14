use crate::billing::domain::{
    ActivityBillingSummary, ActivityFeeSnapshot, ActivitySettlementSummary,
    BalanceCalibrationRecord, BillingFlowResult, DomainError, PenaltyCandidate, SettlementMode,
    SettlementParticipantScope, TransactionRecord, UserAccount, UserBillingRecord,
};
use async_trait::async_trait;
use rust_decimal::Decimal;

#[derive(Debug, Clone)]
pub struct SettlementCharge {
    pub user_id: i64,
    pub amount: Option<Decimal>,
}

pub struct SettlementRequest<'a> {
    pub activity_id: &'a str,
    pub mode: SettlementMode,
    pub participant_scope: SettlementParticipantScope,
    pub total_amount: Decimal,
    pub charges: &'a [SettlementCharge],
    pub description: Option<&'a str>,
    pub created_by_admin_id: Option<i64>,
}

#[async_trait]
pub trait BillingQueryRepository: Send + Sync {
    async fn get_user_account(&self, user_id: i64) -> Result<Option<UserAccount>, DomainError>;
    async fn get_activity_fee_snapshot(
        &self,
        activity_id: &str,
    ) -> Result<Option<ActivityFeeSnapshot>, DomainError>;
    async fn list_activity_fee_snapshots(&self) -> Result<Vec<ActivityFeeSnapshot>, DomainError>;
    async fn get_activity_settlement_summary(
        &self,
        activity_id: &str,
    ) -> Result<ActivitySettlementSummary, DomainError>;
    async fn list_user_billings(&self, user_id: i64)
    -> Result<Vec<UserBillingRecord>, DomainError>;
    async fn list_balance_calibrations(&self)
    -> Result<Vec<BalanceCalibrationRecord>, DomainError>;
    async fn list_transactions(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<TransactionRecord>, DomainError>;
    async fn list_activities_billing(&self) -> Result<Vec<ActivityBillingSummary>, DomainError>;
    async fn list_users_billing(&self) -> Result<Vec<UserAccount>, DomainError>;
    async fn get_user_billing_flow(&self, user_id: i64) -> Result<BillingFlowResult, DomainError>;
    async fn calculate_monthly_penalty_candidates(
        &self,
        month_key: &str,
    ) -> Result<Vec<PenaltyCandidate>, DomainError>;
}

#[async_trait]
pub trait BillingCommandRepository: Send + Sync {
    async fn upsert_activity_fee_snapshot(
        &self,
        activity_id: &str,
        description: &str,
        fee: Decimal,
        total: i32,
    ) -> Result<ActivityFeeSnapshot, DomainError>;
    async fn settle_activity_expense(
        &self,
        activity_id: &str,
        total_amount: Decimal,
        description: Option<&str>,
        created_by_admin_id: Option<i64>,
    ) -> Result<ActivitySettlementSummary, DomainError>;
    async fn settle_activity_expense_with_charges(
        &self,
        request: SettlementRequest<'_>,
    ) -> Result<ActivitySettlementSummary, DomainError>;
    async fn recharge(
        &self,
        user_id: i64,
        amount: Decimal,
        payment_method: &str,
        transaction_no: Option<&str>,
        description: Option<&str>,
    ) -> Result<i64, DomainError>;
    async fn add_activity_expenses(
        &self,
        activity_id: &str,
        user_ids: &[i64],
        fee: Decimal,
        description: Option<&str>,
    ) -> Result<Vec<i64>, DomainError>;
    async fn add_penalty(
        &self,
        user_id: i64,
        month_key: &str,
        amount: Decimal,
        reason: &str,
        created_by: Option<i64>,
    ) -> Result<(i64, Option<i64>), DomainError>;
    async fn calibrate_balance(
        &self,
        user_id: i64,
        target_balance: Decimal,
        effective_time: chrono::NaiveDateTime,
        reason: &str,
        created_by: Option<i64>,
    ) -> Result<(i64, Decimal), DomainError>;
}
