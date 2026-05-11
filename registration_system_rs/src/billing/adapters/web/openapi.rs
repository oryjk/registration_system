#![allow(dead_code)]

use super::dto::{
    ActivityBillingSummaryDto, ActivityOrderDto, ActivitySettlementBatchDto,
    ActivitySettlementSummaryDto, AutoCalculateFeeRequest, AutoCalculateFeeResultDto,
    BalanceCalibrationRecordDto, BillingFlowRecordDto, BillingFlowResultDto,
    CalculatePenaltiesRequest, CalculatePenaltiesResultDto, CalibrateBalanceRequest,
    CalibrationResultDto, CreateActivityOrderRequest, GameExpenseRequest, GameExpenseResultDto,
    PenaltyRequest, PenaltyResultDto, RechargeRequest, RechargeResultDto,
    SettleActivityExpenseRequest, TransactionRecordDto, UserAccountDto,
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
    path = "/game-expense",
    tag = "Account",
    security(("bearer_auth" = [])),
    request_body = GameExpenseRequest,
    responses(
        (status = 200, description = "添加比赛费用成功", body = ApiResponse<GameExpenseResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn game_expense_doc() {}

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
    path = "/orders",
    tag = "Order",
    security(("bearer_auth" = [])),
    request_body = CreateActivityOrderRequest,
    responses(
        (status = 200, description = "创建活动订单成功", body = ApiResponse<ActivityOrderDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn create_activity_order_doc() {}

#[utoipa::path(
    get,
    path = "/orders",
    tag = "Order",
    responses(
        (status = 200, description = "查询活动订单列表成功", body = ApiResponse<Vec<ActivityOrderDto>>)
    )
)]
fn list_orders_doc() {}

#[utoipa::path(
    get,
    path = "/orders/{id}",
    tag = "Order",
    params(
        ("id" = String, Path, description = "活动 ID")
    ),
    responses(
        (status = 200, description = "查询活动订单成功", body = ApiResponse<Option<ActivityOrderDto>>)
    )
)]
fn get_order_doc() {}

#[utoipa::path(
    get,
    path = "/activities/{id}/settlement",
    tag = "Order",
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
    tag = "Order",
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
    path = "/orders/auto-calculate",
    tag = "Order",
    request_body = AutoCalculateFeeRequest,
    responses(
        (status = 200, description = "自动计算费用成功", body = ApiResponse<AutoCalculateFeeResultDto>)
    )
)]
fn auto_calculate_fee_doc() {}

#[utoipa::path(
    post,
    path = "/billing/calculate-penalties",
    tag = "Order",
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
    tag = "Order",
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
    tag = "Order",
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
    tag = "Order",
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
    tag = "Order",
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
        game_expense_doc,
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
            ApiResponse<GameExpenseResultDto>,
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
            GameExpenseResultDto,
            PenaltyResultDto,
            CalibrationResultDto,
            RechargeRequest,
            GameExpenseRequest,
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
        create_activity_order_doc,
        list_orders_doc,
        get_order_doc,
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
            ApiResponse<ActivityOrderDto>,
            ApiResponse<Vec<ActivityOrderDto>>,
            ApiResponse<Option<ActivityOrderDto>>,
            ApiResponse<ActivitySettlementSummaryDto>,
            ApiResponse<AutoCalculateFeeResultDto>,
            ApiResponse<CalculatePenaltiesResultDto>,
            ApiResponse<Vec<ActivityBillingSummaryDto>>,
            ApiResponse<Vec<UserAccountDto>>,
            ApiResponse<BillingFlowResultDto>,
            ApiResponse<EmptyData>,
            EmptyData,
            UserAccountDto,
            ActivityOrderDto,
            BillingFlowRecordDto,
            BillingFlowResultDto,
            ActivityBillingSummaryDto,
            ActivitySettlementSummaryDto,
            ActivitySettlementBatchDto,
            PenaltyResultDto,
            AutoCalculateFeeResultDto,
            CalculatePenaltiesResultDto,
            CreateActivityOrderRequest,
            AutoCalculateFeeRequest,
            SettleActivityExpenseRequest,
            CalculatePenaltiesRequest
        )
    ),
    tags(
        (name = "Order", description = "订单、账单汇总与费用计算")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct OrderApiDoc;
