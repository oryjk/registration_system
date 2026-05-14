use crate::billing::application::{ActivityExpenseResult, CalibrationResult, PenaltyResult};
use crate::billing::domain::{
    ActivityBillingSummary, ActivityFeeSnapshot, ActivitySettlementBatch, ActivitySettlementItem,
    ActivitySettlementSummary, BalanceCalibrationRecord, BillingFlowRecord, BillingFlowResult,
    TransactionRecord, UserAccount,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpsertActivityFeeSnapshotRequest {
    pub activity_id: String,
    pub description: String,
    #[schema(value_type = String)]
    pub fee: Decimal,
    pub total: i32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RechargeRequest {
    pub user_id: i64,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub payment_method: String,
    pub transaction_no: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ActivityExpenseRequest {
    pub activity_id: String,
    #[schema(value_type = String)]
    pub total_amount: Decimal,
    pub user_ids: Vec<i64>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct PenaltyRequest {
    pub user_id: i64,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub reason: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CalibrateBalanceRequest {
    pub user_id: i64,
    #[schema(value_type = String)]
    pub balance: Decimal,
    pub effective_time: chrono::NaiveDateTime,
    pub reason: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AutoCalculateFeeRequest {
    pub number: i32,
    #[schema(value_type = String)]
    pub total: Decimal,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SettleActivityExpenseRequest {
    #[schema(value_type = String)]
    pub total_amount: Decimal,
    pub mode: Option<String>,
    pub participant_scope: Option<String>,
    pub items: Option<Vec<SettleActivityExpenseItemRequest>>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SettleActivityExpenseItemRequest {
    pub user_id: i64,
    #[schema(value_type = Option<String>)]
    pub amount: Option<Decimal>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CalculatePenaltiesRequest {
    pub month_key: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserAccountDto {
    pub user_id: i64,
    #[schema(value_type = String)]
    pub balance: Decimal,
    #[schema(value_type = String)]
    pub total_recharge: Decimal,
    #[schema(value_type = String)]
    pub total_expense: Decimal,
    #[schema(value_type = String)]
    pub total_penalty: Decimal,
}

impl From<UserAccount> for UserAccountDto {
    fn from(value: UserAccount) -> Self {
        Self {
            user_id: value.user_id,
            balance: value.balance,
            total_recharge: value.total_recharge,
            total_expense: value.total_expense,
            total_penalty: value.total_penalty,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivityFeeSnapshotDto {
    pub id: i64,
    pub activity_id: String,
    pub description: String,
    #[schema(value_type = String)]
    pub fee: Decimal,
    pub total: i32,
}

impl From<ActivityFeeSnapshot> for ActivityFeeSnapshotDto {
    fn from(value: ActivityFeeSnapshot) -> Self {
        Self {
            id: value.id,
            activity_id: value.activity_id,
            description: value.description,
            fee: value.fee,
            total: value.total,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TransactionRecordDto {
    pub id: i64,
    pub user_id: i64,
    pub record_type: String,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub description: Option<String>,
    pub activity_id: Option<String>,
    pub created_at: chrono::NaiveDateTime,
}

impl From<TransactionRecord> for TransactionRecordDto {
    fn from(value: TransactionRecord) -> Self {
        Self {
            id: value.id,
            user_id: value.user_id,
            record_type: value.record_type,
            amount: value.amount,
            description: value.description,
            activity_id: value.activity_id,
            created_at: value.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct BalanceCalibrationRecordDto {
    pub id: i64,
    pub user_id: i64,
    pub user_name: Option<String>,
    #[schema(value_type = String)]
    pub target_balance: Decimal,
    pub effective_time: chrono::NaiveDateTime,
    pub reason: String,
    pub created_by: Option<i64>,
    pub created_by_name: Option<String>,
    pub created_at: chrono::NaiveDateTime,
}

impl From<BalanceCalibrationRecord> for BalanceCalibrationRecordDto {
    fn from(value: BalanceCalibrationRecord) -> Self {
        Self {
            id: value.id,
            user_id: value.user_id,
            user_name: value.user_name,
            target_balance: value.target_balance,
            effective_time: value.effective_time,
            reason: value.reason,
            created_by: value.created_by,
            created_by_name: value.created_by_name,
            created_at: value.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct BillingFlowRecordDto {
    pub id: String,
    pub record_type: String,
    pub type_name: String,
    #[schema(value_type = String)]
    pub amount: Decimal,
    pub description: String,
    pub activity_id: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    #[schema(value_type = String)]
    pub balance: Decimal,
}

impl From<BillingFlowRecord> for BillingFlowRecordDto {
    fn from(value: BillingFlowRecord) -> Self {
        Self {
            id: value.id,
            record_type: value.record_type,
            type_name: value.type_name,
            amount: value.amount,
            description: value.description,
            activity_id: value.activity_id,
            created_at: value.created_at,
            balance: value.balance,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct BillingFlowResultDto {
    pub records: Vec<BillingFlowRecordDto>,
    #[schema(value_type = String)]
    pub final_balance: Decimal,
}

impl From<BillingFlowResult> for BillingFlowResultDto {
    fn from(value: BillingFlowResult) -> Self {
        Self {
            records: value
                .records
                .into_iter()
                .map(BillingFlowRecordDto::from)
                .collect(),
            final_balance: value.final_balance,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivityBillingSummaryDto {
    pub month_key: String,
    pub activity_id: String,
    pub activity_name: String,
    pub holding_date: chrono::NaiveDateTime,
    pub location: String,
    pub total: Option<i32>,
    #[schema(value_type = Option<String>)]
    pub fee: Option<Decimal>,
    pub user_id: Option<i64>,
    pub stand: Option<i8>,
    pub registration_count: Option<i32>,
}

impl From<ActivityBillingSummary> for ActivityBillingSummaryDto {
    fn from(value: ActivityBillingSummary) -> Self {
        Self {
            month_key: value.month_key,
            activity_id: value.activity_id,
            activity_name: value.activity_name,
            holding_date: value.holding_date,
            location: value.location,
            total: value.total,
            fee: value.fee,
            user_id: value.user_id,
            stand: value.stand,
            registration_count: value.registration_count,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivitySettlementSummaryDto {
    pub activity_id: String,
    pub mode: Option<String>,
    pub participant_scope: Option<String>,
    pub description: Option<String>,
    #[schema(value_type = Option<String>)]
    pub total_amount: Option<Decimal>,
    #[schema(value_type = Option<String>)]
    pub aa_fee: Option<Decimal>,
    pub attending_user_count: i32,
    pub settled_user_count: i32,
    pub settled: bool,
    pub settled_at: Option<chrono::NaiveDateTime>,
    pub current_batch_no: Option<i32>,
    pub history: Vec<ActivitySettlementBatchDto>,
    pub items: Vec<ActivitySettlementItemDto>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivitySettlementBatchDto {
    pub batch_no: i32,
    pub operation_type: String,
    pub mode: String,
    pub participant_scope: String,
    pub reversal_of_batch_no: Option<i32>,
    pub description: String,
    #[schema(value_type = String)]
    pub total_amount: Decimal,
    #[schema(value_type = String)]
    pub aa_fee: Decimal,
    pub user_count: i32,
    pub created_by_admin_id: Option<i64>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivitySettlementItemDto {
    pub user_id: i64,
    pub user_name: Option<String>,
    #[schema(value_type = Option<String>)]
    pub fee: Option<Decimal>,
    pub billed: bool,
    pub billing_id: Option<i64>,
}

impl From<ActivitySettlementItem> for ActivitySettlementItemDto {
    fn from(value: ActivitySettlementItem) -> Self {
        Self {
            user_id: value.user_id,
            user_name: value.user_name,
            fee: value.fee,
            billed: value.billed,
            billing_id: value.billing_id,
        }
    }
}

impl From<ActivitySettlementBatch> for ActivitySettlementBatchDto {
    fn from(value: ActivitySettlementBatch) -> Self {
        Self {
            batch_no: value.batch_no,
            operation_type: value.operation_type,
            mode: value.mode.as_str().to_string(),
            participant_scope: value.participant_scope.as_str().to_string(),
            reversal_of_batch_no: value.reversal_of_batch_no,
            description: value.description,
            total_amount: value.total_amount,
            aa_fee: value.aa_fee,
            user_count: value.user_count,
            created_by_admin_id: value.created_by_admin_id,
            created_at: value.created_at,
        }
    }
}

impl From<ActivitySettlementSummary> for ActivitySettlementSummaryDto {
    fn from(value: ActivitySettlementSummary) -> Self {
        Self {
            activity_id: value.activity_id,
            mode: value.mode.map(|mode| mode.as_str().to_string()),
            participant_scope: value
                .participant_scope
                .map(|scope| scope.as_str().to_string()),
            description: value.description,
            total_amount: value.total_amount,
            aa_fee: value.aa_fee,
            attending_user_count: value.attending_user_count,
            settled_user_count: value.settled_user_count,
            settled: value.settled,
            settled_at: value.settled_at,
            current_batch_no: value.current_batch_no,
            history: value
                .history
                .into_iter()
                .map(ActivitySettlementBatchDto::from)
                .collect(),
            items: value
                .items
                .into_iter()
                .map(ActivitySettlementItemDto::from)
                .collect(),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RechargeResultDto {
    pub recharge_id: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivityExpenseResultDto {
    pub activity_id: String,
    #[schema(value_type = String)]
    pub total_amount: Decimal,
    #[schema(value_type = String)]
    pub aa_fee: Decimal,
    pub user_count: usize,
    pub billing_ids: Vec<i64>,
}

impl From<ActivityExpenseResult> for ActivityExpenseResultDto {
    fn from(value: ActivityExpenseResult) -> Self {
        Self {
            activity_id: value.activity_id,
            total_amount: value.total_amount,
            aa_fee: value.aa_fee,
            user_count: value.user_count,
            billing_ids: value.billing_ids,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PenaltyResultDto {
    pub penalty_id: i64,
    pub fund_transaction_id: Option<i64>,
}

impl From<PenaltyResult> for PenaltyResultDto {
    fn from(value: PenaltyResult) -> Self {
        Self {
            penalty_id: value.penalty_id,
            fund_transaction_id: value.fund_transaction_id,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CalibrationResultDto {
    pub calibration_id: i64,
    #[schema(value_type = String)]
    pub current_balance: Decimal,
}

impl From<CalibrationResult> for CalibrationResultDto {
    fn from(value: CalibrationResult) -> Self {
        Self {
            calibration_id: value.calibration_id,
            current_balance: value.current_balance,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AutoCalculateFeeResultDto {
    #[schema(value_type = String)]
    pub fee: Decimal,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CalculatePenaltiesResultDto {
    pub month_key: String,
    pub count: usize,
    pub items: Vec<PenaltyResultDto>,
}
