use crate::billing::application::commands::{
    ActivityExpenseCommand, CalibrateBalanceCommand, PenaltyCommand, RechargeCommand,
    SettleActivityExpenseCommand, UpsertActivityFeeSnapshotCommand,
};
use crate::billing::application::read_models::{
    ActivityExpenseResult, CalibrationResult, PenaltyResult,
};
use crate::billing::application::use_cases::{
    BillingAccountUseCase, BillingActivityFeeSnapshotUseCase, BillingAdjustmentUseCase,
    BillingReportUseCase, BillingSettlementUseCase,
};
use crate::billing::domain::{
    ActivityBillingSummary, ActivityFeeSnapshot, ActivitySettlementSummary,
    BalanceCalibrationRecord, BillingFlowResult, TransactionRecord, UserAccount,
};
use crate::billing::ports::{
    BillingActivityAccessPort, BillingCommandRepository, BillingQueryRepository,
};
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use rust_decimal::Decimal;
use std::sync::Arc;

#[derive(Clone)]
pub struct BillingService {
    account_use_case: BillingAccountUseCase,
    adjustment_use_case: BillingAdjustmentUseCase,
    activity_fee_snapshot_use_case: BillingActivityFeeSnapshotUseCase,
    report_use_case: BillingReportUseCase,
    settlement_use_case: BillingSettlementUseCase,
}

impl BillingService {
    pub fn new(
        query_repository: Arc<dyn BillingQueryRepository>,
        command_repository: Arc<dyn BillingCommandRepository>,
        activity_access_port: Arc<dyn BillingActivityAccessPort>,
    ) -> Self {
        Self {
            account_use_case: BillingAccountUseCase::new(query_repository.clone()),
            adjustment_use_case: BillingAdjustmentUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
            ),
            activity_fee_snapshot_use_case: BillingActivityFeeSnapshotUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
            ),
            report_use_case: BillingReportUseCase::new(query_repository.clone()),
            settlement_use_case: BillingSettlementUseCase::new(
                query_repository,
                command_repository,
                activity_access_port,
            ),
        }
    }

    pub async fn get_my_balance(
        &self,
        actor: &ActorContext,
    ) -> Result<Option<UserAccount>, AppError> {
        self.account_use_case.get_my_balance(actor).await
    }

    pub async fn upsert_activity_fee_snapshot(
        &self,
        actor: &ActorContext,
        command: UpsertActivityFeeSnapshotCommand,
    ) -> Result<ActivityFeeSnapshot, AppError> {
        self.activity_fee_snapshot_use_case
            .upsert_activity_fee_snapshot(actor, command)
            .await
    }

    pub async fn list_my_billings(
        &self,
        actor: &ActorContext,
    ) -> Result<BillingFlowResult, AppError> {
        self.account_use_case.list_my_billings(actor).await
    }

    pub async fn get_user_balance(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<Option<UserAccount>, AppError> {
        self.account_use_case
            .get_user_balance(actor, target_user_id)
            .await
    }

    pub async fn recharge(
        &self,
        actor: &ActorContext,
        command: RechargeCommand,
    ) -> Result<i64, AppError> {
        self.adjustment_use_case.recharge(actor, command).await
    }

    pub async fn add_activity_expense(
        &self,
        actor: &ActorContext,
        command: ActivityExpenseCommand,
    ) -> Result<ActivityExpenseResult, AppError> {
        self.settlement_use_case
            .add_activity_expense(actor, command)
            .await
    }

    pub async fn get_activity_settlement_summary(
        &self,
        actor: &ActorContext,
        activity_id: &str,
    ) -> Result<ActivitySettlementSummary, AppError> {
        self.settlement_use_case
            .get_activity_settlement_summary(actor, activity_id)
            .await
    }

    pub async fn settle_activity_expense(
        &self,
        actor: &ActorContext,
        command: SettleActivityExpenseCommand,
    ) -> Result<ActivitySettlementSummary, AppError> {
        self.settlement_use_case
            .settle_activity_expense(actor, command)
            .await
    }

    pub async fn add_penalty(
        &self,
        actor: &ActorContext,
        command: PenaltyCommand,
    ) -> Result<PenaltyResult, AppError> {
        self.adjustment_use_case.add_penalty(actor, command).await
    }

    pub async fn calibrate_balance(
        &self,
        actor: &ActorContext,
        command: CalibrateBalanceCommand,
    ) -> Result<CalibrationResult, AppError> {
        self.adjustment_use_case
            .calibrate_balance(actor, command)
            .await
    }

    pub async fn list_balance_calibrations(
        &self,
        actor: &ActorContext,
    ) -> Result<Vec<BalanceCalibrationRecord>, AppError> {
        self.adjustment_use_case
            .list_balance_calibrations(actor)
            .await
    }

    pub async fn list_transactions(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
        limit: i64,
    ) -> Result<Vec<TransactionRecord>, AppError> {
        self.account_use_case
            .list_transactions(actor, target_user_id, limit)
            .await
    }

    pub async fn get_activity_fee_snapshot_by_activity_id(
        &self,
        activity_id: &str,
    ) -> Result<Option<ActivityFeeSnapshot>, AppError> {
        self.activity_fee_snapshot_use_case
            .get_activity_fee_snapshot_by_activity_id(activity_id)
            .await
    }

    pub async fn list_activity_fee_snapshots(&self) -> Result<Vec<ActivityFeeSnapshot>, AppError> {
        self.activity_fee_snapshot_use_case
            .list_activity_fee_snapshots()
            .await
    }

    pub fn auto_calculate_fee(&self, number: i32, total: Decimal) -> Result<Decimal, AppError> {
        self.settlement_use_case.auto_calculate_fee(number, total)
    }

    pub async fn calculate_monthly_penalties(
        &self,
        actor: &ActorContext,
        month_key: &str,
    ) -> Result<Vec<PenaltyResult>, AppError> {
        self.adjustment_use_case
            .calculate_monthly_penalties(actor, month_key)
            .await
    }

    pub async fn get_activities_billing(
        &self,
        actor: &ActorContext,
    ) -> Result<Vec<ActivityBillingSummary>, AppError> {
        self.report_use_case.get_activities_billing(actor).await
    }

    pub async fn get_users_billing(
        &self,
        actor: &ActorContext,
    ) -> Result<Vec<UserAccount>, AppError> {
        self.report_use_case.get_users_billing(actor).await
    }

    pub async fn get_user_billing_flow(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<BillingFlowResult, AppError> {
        self.account_use_case
            .get_user_billing_flow(actor, target_user_id)
            .await
    }
}
