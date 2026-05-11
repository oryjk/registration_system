use crate::billing::adapters::web::dto::{
    ActivityBillingSummaryDto, ActivityOrderDto, ActivitySettlementSummaryDto,
    AutoCalculateFeeRequest, AutoCalculateFeeResultDto, BalanceCalibrationRecordDto,
    BillingFlowResultDto, CalculatePenaltiesRequest, CalculatePenaltiesResultDto,
    CalibrateBalanceRequest, CalibrationResultDto, CreateActivityOrderRequest, GameExpenseRequest,
    GameExpenseResultDto, PenaltyRequest, PenaltyResultDto, RechargeRequest, RechargeResultDto,
    SettleActivityExpenseRequest, TransactionRecordDto, UserAccountDto,
};
use crate::billing::application::{
    CalibrateBalanceCommand, CreateActivityOrderCommand, GameExpenseCommand, PenaltyCommand,
    RechargeCommand, SettleActivityExpenseCommand,
};
use crate::bootstrap::app::AppState;
use crate::shared::api_response::ApiResponse;
use crate::shared::http_error::HttpError;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use serde::Deserialize;
use utoipa::IntoParams;

#[derive(Debug, Deserialize, IntoParams)]
pub struct TransactionQuery {
    pub limit: Option<i64>,
}

pub async fn get_my_balance_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<Option<UserAccountDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let account = state
        .services
        .billing_service
        .get_my_balance(&actor)
        .await?;

    Ok(Json(ApiResponse::success(
        account.map(UserAccountDto::from),
    )))
}

pub async fn get_user_balance_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<Option<UserAccountDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let account = state
        .services
        .billing_service
        .get_user_balance(&actor, user_id)
        .await?;

    Ok(Json(ApiResponse::success(
        account.map(UserAccountDto::from),
    )))
}

pub async fn create_activity_order_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateActivityOrderRequest>,
) -> Result<Json<ApiResponse<ActivityOrderDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let order = state
        .services
        .billing_service
        .create_activity_order(
            &actor,
            CreateActivityOrderCommand {
                activity_id: payload.activity_id,
                description: payload.description,
                fee: payload.fee,
                total: payload.total,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "活动订单创建成功",
        ActivityOrderDto::from(order),
    )))
}

pub async fn list_my_billings_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<BillingFlowResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let result = state
        .services
        .billing_service
        .list_my_billings(&actor)
        .await?;

    Ok(Json(ApiResponse::success(BillingFlowResultDto::from(
        result,
    ))))
}

pub async fn recharge_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<RechargeRequest>,
) -> Result<Json<ApiResponse<RechargeResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let recharge_id = state
        .services
        .billing_service
        .recharge(
            &actor,
            RechargeCommand {
                user_id: payload.user_id,
                amount: payload.amount,
                payment_method: payload.payment_method,
                transaction_no: payload.transaction_no,
                description: payload.description,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "充值成功",
        RechargeResultDto { recharge_id },
    )))
}

pub async fn game_expense_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<GameExpenseRequest>,
) -> Result<Json<ApiResponse<GameExpenseResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let result = state
        .services
        .billing_service
        .add_game_expense(
            &actor,
            GameExpenseCommand {
                activity_id: payload.activity_id,
                total_amount: payload.total_amount,
                user_ids: payload.user_ids,
                description: payload.description,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "扣费成功",
        GameExpenseResultDto::from(result),
    )))
}

pub async fn penalty_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<PenaltyRequest>,
) -> Result<Json<ApiResponse<PenaltyResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let result = state
        .services
        .billing_service
        .add_penalty(
            &actor,
            PenaltyCommand {
                user_id: payload.user_id,
                amount: payload.amount,
                reason: payload.reason,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "罚款成功",
        PenaltyResultDto::from(result),
    )))
}

pub async fn calibrate_balance_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CalibrateBalanceRequest>,
) -> Result<Json<ApiResponse<CalibrationResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let result = state
        .services
        .billing_service
        .calibrate_balance(
            &actor,
            CalibrateBalanceCommand {
                user_id: payload.user_id,
                balance: payload.balance,
                effective_time: payload.effective_time,
                reason: payload.reason,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "余额校准成功",
        CalibrationResultDto::from(result),
    )))
}

pub async fn balance_calibrations_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<Vec<BalanceCalibrationRecordDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .billing_service
        .list_balance_calibrations(&actor)
        .await?;

    Ok(Json(ApiResponse::success(
        items
            .into_iter()
            .map(BalanceCalibrationRecordDto::from)
            .collect(),
    )))
}

pub async fn transactions_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<TransactionQuery>,
) -> Result<Json<ApiResponse<Vec<TransactionRecordDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .billing_service
        .list_transactions(&actor, actor.id, query.limit.unwrap_or(50))
        .await?;

    Ok(Json(ApiResponse::success(
        items.into_iter().map(TransactionRecordDto::from).collect(),
    )))
}

pub async fn user_transactions_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
    Query(query): Query<TransactionQuery>,
) -> Result<Json<ApiResponse<Vec<TransactionRecordDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .billing_service
        .list_transactions(&actor, user_id, query.limit.unwrap_or(50))
        .await?;

    Ok(Json(ApiResponse::success(
        items.into_iter().map(TransactionRecordDto::from).collect(),
    )))
}

pub async fn get_order_handler(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
) -> Result<Json<ApiResponse<Option<ActivityOrderDto>>>, HttpError> {
    let order = state
        .services
        .billing_service
        .get_order_by_id(&activity_id)
        .await?;
    Ok(Json(ApiResponse::success(
        order.map(ActivityOrderDto::from),
    )))
}

pub async fn list_orders_handler(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<ActivityOrderDto>>>, HttpError> {
    let items = state.services.billing_service.list_orders().await?;
    Ok(Json(ApiResponse::success(
        items.into_iter().map(ActivityOrderDto::from).collect(),
    )))
}

pub async fn auto_calculate_fee_handler(
    State(state): State<AppState>,
    Json(payload): Json<AutoCalculateFeeRequest>,
) -> Result<Json<ApiResponse<AutoCalculateFeeResultDto>>, HttpError> {
    let fee = state
        .services
        .billing_service
        .auto_calculate_fee(payload.number, payload.total)?;
    Ok(Json(ApiResponse::success(AutoCalculateFeeResultDto {
        fee,
    })))
}

pub async fn get_activity_settlement_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
) -> Result<Json<ApiResponse<ActivitySettlementSummaryDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let summary = state
        .services
        .billing_service
        .get_activity_settlement_summary(&actor, &activity_id)
        .await?;

    Ok(Json(ApiResponse::success(
        ActivitySettlementSummaryDto::from(summary),
    )))
}

pub async fn settle_activity_expense_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(activity_id): Path<String>,
    Json(payload): Json<SettleActivityExpenseRequest>,
) -> Result<Json<ApiResponse<ActivitySettlementSummaryDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let summary = state
        .services
        .billing_service
        .settle_activity_expense(
            &actor,
            SettleActivityExpenseCommand {
                activity_id,
                total_amount: payload.total_amount,
                description: payload.description,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "比赛费用结算成功",
        ActivitySettlementSummaryDto::from(summary),
    )))
}

pub async fn calculate_penalties_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CalculatePenaltiesRequest>,
) -> Result<Json<ApiResponse<CalculatePenaltiesResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .billing_service
        .calculate_monthly_penalties(&actor, &payload.month_key)
        .await?;
    let month_key = payload.month_key.clone();
    let count = items.len();
    Ok(Json(ApiResponse::success(CalculatePenaltiesResultDto {
        month_key,
        count,
        items: items.into_iter().map(PenaltyResultDto::from).collect(),
    })))
}

pub async fn activities_billing_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<Vec<ActivityBillingSummaryDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .billing_service
        .get_activities_billing(&actor)
        .await?;
    Ok(Json(ApiResponse::success(
        items
            .into_iter()
            .map(ActivityBillingSummaryDto::from)
            .collect(),
    )))
}

pub async fn users_billing_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<Vec<UserAccountDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let items = state
        .services
        .billing_service
        .get_users_billing(&actor)
        .await?;
    Ok(Json(ApiResponse::success(
        items.into_iter().map(UserAccountDto::from).collect(),
    )))
}

pub async fn user_billing_flow_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<BillingFlowResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let result = state
        .services
        .billing_service
        .get_user_billing_flow(&actor, user_id)
        .await?;
    Ok(Json(ApiResponse::success(BillingFlowResultDto::from(
        result,
    ))))
}
