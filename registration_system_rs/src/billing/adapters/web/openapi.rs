#![allow(dead_code)]

use super::dto::{
    ActivityBillingSummaryDto, ActivityExpenseRequest, ActivityExpenseResultDto,
    ActivityFeeSnapshotDto, ActivitySettlementBatchDto, ActivitySettlementSummaryDto,
    AutoCalculateFeeRequest, AutoCalculateFeeResultDto, BalanceCalibrationRecordDto,
    BillingFlowRecordDto, BillingFlowResultDto, CalculatePenaltiesRequest,
    CalculatePenaltiesResultDto, CalibrateBalanceRequest, CalibrationResultDto, PenaltyRequest,
    PenaltyResultDto, RechargeRequest, RechargeResultDto, SettleActivityExpenseRequest,
    TransactionRecordDto, UpsertActivityFeeSnapshotRequest, UserAccountDto,
};
use super::handlers::TransactionQuery;
use crate::shared::api_response::{ApiResponse, EmptyData};
use crate::shared::openapi::BearerSecurityAddon;
use utoipa::OpenApi;

#[utoipa::path(
    get,
    path = "/balance",
    tag = "Account",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "获取当前用户余额成功", body = ApiResponse<Option<UserAccountDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_my_balance_doc() {}

#[utoipa::path(
    get,
    path = "/{user_id}/balance",
    tag = "Account",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "获取指定用户余额成功", body = ApiResponse<Option<UserAccountDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_user_balance_doc() {}

#[utoipa::path(
    post,
    path = "/recharge",
    tag = "Account",
    security(("bearer_auth" = [])),
    request_body = RechargeRequest,
    responses(
        (status = 200, description = "充值成功", body = ApiResponse<RechargeResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn recharge_doc() {}

#[utoipa::path(
    post,
    path = "/activity-expense",
    tag = "Account",
    security(("bearer_auth" = [])),
    request_body = ActivityExpenseRequest,
    responses(
        (status = 200, description = "添加活动费用成功", body = ApiResponse<ActivityExpenseResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn activity_expense_doc() {}

#[utoipa::path(
    post,
    path = "/penalty",
    tag = "Account",
    security(("bearer_auth" = [])),
    request_body = PenaltyRequest,
    responses(
        (status = 200, description = "添加罚款成功", body = ApiResponse<PenaltyResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn penalty_doc() {}

#[utoipa::path(
    post,
    path = "/calibrate-balance",
    tag = "Account",
    security(("bearer_auth" = [])),
    request_body = CalibrateBalanceRequest,
    responses(
        (status = 200, description = "余额校准成功", body = ApiResponse<CalibrationResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn calibrate_balance_doc() {}

#[utoipa::path(
    get,
    path = "/balance-calibrations",
    tag = "Account",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "查询余额校准记录成功", body = ApiResponse<Vec<BalanceCalibrationRecordDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn balance_calibrations_doc() {}

#[utoipa::path(
    get,
    path = "/transactions",
    tag = "Account",
    security(("bearer_auth" = [])),
    params(TransactionQuery),
    responses(
        (status = 200, description = "查询当前用户流水成功", body = ApiResponse<Vec<TransactionRecordDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn transactions_doc() {}

#[utoipa::path(
    get,
    path = "/{user_id}/transactions",
    tag = "Account",
    security(("bearer_auth" = [])),
    params(
        TransactionQuery,
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "查询指定用户流水成功", body = ApiResponse<Vec<TransactionRecordDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn user_transactions_doc() {}

#[utoipa::path(
    post,
    path = "/activity-fee-snapshots",
    tag = "Billing",
    security(("bearer_auth" = [])),
    request_body = UpsertActivityFeeSnapshotRequest,
    responses(
        (status = 200, description = "保存活动费用快照成功", body = ApiResponse<ActivityFeeSnapshotDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn upsert_activity_fee_snapshot_doc() {}

#[utoipa::path(
    get,
    path = "/activity-fee-snapshots",
    tag = "Billing",
    responses(
        (status = 200, description = "查询活动费用快照列表成功", body = ApiResponse<Vec<ActivityFeeSnapshotDto>>)
    )
)]
fn list_activity_fee_snapshots_doc() {}

#[utoipa::path(
    get,
    path = "/activity-fee-snapshots/{id}",
    tag = "Billing",
    params(
        ("id" = String, Path, description = "活动 ID")
    ),
    responses(
        (status = 200, description = "查询活动费用快照成功", body = ApiResponse<Option<ActivityFeeSnapshotDto>>)
    )
)]
fn get_activity_fee_snapshot_doc() {}

#[utoipa::path(
    get,
    path = "/activities/{id}/settlement",
    tag = "Billing",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "活动 ID")
    ),
    responses(
        (status = 200, description = "查询活动结算信息成功", body = ApiResponse<ActivitySettlementSummaryDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_activity_settlement_doc() {}

#[utoipa::path(
    post,
    path = "/activities/{id}/settlement",
    tag = "Billing",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "活动 ID")
    ),
    request_body = SettleActivityExpenseRequest,
    responses(
        (status = 200, description = "结算活动费用成功", body = ApiResponse<ActivitySettlementSummaryDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn settle_activity_expense_doc() {}

#[utoipa::path(
    post,
    path = "/fee/auto-calculate",
    tag = "Billing",
    request_body = AutoCalculateFeeRequest,
    responses(
        (status = 200, description = "自动计算费用成功", body = ApiResponse<AutoCalculateFeeResultDto>)
    )
)]
fn auto_calculate_fee_doc() {}

#[utoipa::path(
    post,
    path = "/billing/calculate-penalties",
    tag = "Billing",
    security(("bearer_auth" = [])),
    request_body = CalculatePenaltiesRequest,
    responses(
        (status = 200, description = "计算月度罚款成功", body = ApiResponse<CalculatePenaltiesResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn calculate_penalties_doc() {}

#[utoipa::path(
    get,
    path = "/activities/billing",
    tag = "Billing",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "查询活动账单汇总成功", body = ApiResponse<Vec<ActivityBillingSummaryDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn activities_billing_doc() {}

#[utoipa::path(
    get,
    path = "/users/billing",
    tag = "Billing",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "查询用户账单汇总成功", body = ApiResponse<Vec<UserAccountDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn users_billing_doc() {}

#[utoipa::path(
    get,
    path = "/my-billing-flow",
    tag = "Billing",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "查询当前用户账单流水成功", body = ApiResponse<BillingFlowResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn list_my_billings_doc() {}

#[utoipa::path(
    get,
    path = "/users/{user_id}/billing-flow",
    tag = "Billing",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "查询指定用户账单流水成功", body = ApiResponse<BillingFlowResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn user_billing_flow_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        get_my_balance_doc,
        get_user_balance_doc,
        recharge_doc,
        activity_expense_doc,
        penalty_doc,
        calibrate_balance_doc,
        balance_calibrations_doc,
        transactions_doc,
        user_transactions_doc
    ),
    components(
        schemas(
            ApiResponse<Option<UserAccountDto>>,
            ApiResponse<RechargeResultDto>,
            ApiResponse<ActivityExpenseResultDto>,
            ApiResponse<PenaltyResultDto>,
            ApiResponse<CalibrationResultDto>,
            ApiResponse<Vec<BalanceCalibrationRecordDto>>,
            ApiResponse<Vec<TransactionRecordDto>>,
            ApiResponse<EmptyData>,
            EmptyData,
            UserAccountDto,
            TransactionRecordDto,
            BalanceCalibrationRecordDto,
            RechargeResultDto,
            ActivityExpenseResultDto,
            PenaltyResultDto,
            CalibrationResultDto,
            RechargeRequest,
            ActivityExpenseRequest,
            PenaltyRequest,
            CalibrateBalanceRequest
        )
    ),
    tags(
        (name = "Account", description = "余额、充值、校准与交易流水")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct AccountApiDoc;

#[derive(OpenApi)]
#[openapi(
    paths(
        upsert_activity_fee_snapshot_doc,
        list_activity_fee_snapshots_doc,
        get_activity_fee_snapshot_doc,
        get_activity_settlement_doc,
        settle_activity_expense_doc,
        auto_calculate_fee_doc,
        calculate_penalties_doc,
        activities_billing_doc,
        users_billing_doc,
        list_my_billings_doc,
        user_billing_flow_doc
    ),
    components(
        schemas(
            ApiResponse<ActivityFeeSnapshotDto>,
            ApiResponse<Vec<ActivityFeeSnapshotDto>>,
            ApiResponse<Option<ActivityFeeSnapshotDto>>,
            ApiResponse<ActivitySettlementSummaryDto>,
            ApiResponse<AutoCalculateFeeResultDto>,
            ApiResponse<CalculatePenaltiesResultDto>,
            ApiResponse<Vec<ActivityBillingSummaryDto>>,
            ApiResponse<Vec<UserAccountDto>>,
            ApiResponse<BillingFlowResultDto>,
            ApiResponse<EmptyData>,
            EmptyData,
            UserAccountDto,
            ActivityFeeSnapshotDto,
            BillingFlowRecordDto,
            BillingFlowResultDto,
            ActivityBillingSummaryDto,
            ActivitySettlementSummaryDto,
            ActivitySettlementBatchDto,
            PenaltyResultDto,
            AutoCalculateFeeResultDto,
            CalculatePenaltiesResultDto,
            UpsertActivityFeeSnapshotRequest,
            AutoCalculateFeeRequest,
            SettleActivityExpenseRequest,
            CalculatePenaltiesRequest
        )
    ),
    tags(
        (name = "Billing", description = "账单汇总、费用快照与费用计算")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct BillingApiDoc;
