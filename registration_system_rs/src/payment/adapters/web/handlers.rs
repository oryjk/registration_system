use crate::bootstrap::app::AppState;
use crate::payment::adapters::web::dto::{
    CancelOrderRequest, CancelOrderResultDto, CreateRechargeOrderRequest,
    CreateRechargeOrderResultDto, CreateTeamMembershipOrderRequest,
    CreateTeamMembershipOrderResultDto, OrderStatusDto, PaymentOrderDto, PaymentOrderStatusDto,
    SyncOrderStatusDto, WxMiniPaymentParamsDto,
};
use crate::payment::application::CreateTeamMembershipOrderCommand;
use crate::shared::api_response::ApiResponse;
use crate::shared::http_error::HttpError;
use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::IntoResponse;
use serde::Deserialize;
use utoipa::IntoParams;

#[derive(Debug, Deserialize, IntoParams)]
pub struct OrderListQuery {
    pub limit: Option<i64>,
}

pub async fn create_recharge_order_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateRechargeOrderRequest>,
) -> Result<Json<ApiResponse<CreateRechargeOrderResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let result = state
        .services
        .payment_service
        .create_recharge_order(&actor, payload.amount, payload.openid.as_deref())
        .await?;

    Ok(Json(ApiResponse::with_message(
        "订单创建成功",
        CreateRechargeOrderResultDto {
            order_no: result.order_no,
            params: WxMiniPaymentParamsDto {
                time_stamp: result.params.time_stamp,
                nonce_str: result.params.nonce_str,
                package: result.params.package,
                sign_type: result.params.sign_type,
                pay_sign: result.params.pay_sign,
            },
        },
    )))
}

pub async fn create_team_membership_order_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateTeamMembershipOrderRequest>,
) -> Result<Json<ApiResponse<CreateTeamMembershipOrderResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let result = state
        .services
        .payment_service
        .create_team_membership_order(
            &actor,
            CreateTeamMembershipOrderCommand {
                team_id: payload.team_id,
                months: payload.months,
                openid: payload.openid,
                note: payload.note,
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "球队会员订单创建成功",
        CreateTeamMembershipOrderResultDto {
            order_no: result.order_no,
            params: WxMiniPaymentParamsDto {
                time_stamp: result.params.time_stamp,
                nonce_str: result.params.nonce_str,
                package: result.params.package,
                sign_type: result.params.sign_type,
                pay_sign: result.params.pay_sign,
            },
        },
    )))
}

pub async fn get_order_status_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(order_no): Path<String>,
) -> Result<Json<ApiResponse<OrderStatusDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let order = state
        .services
        .payment_service
        .get_order_status(&actor, &order_no)
        .await?;

    Ok(Json(ApiResponse::success(OrderStatusDto {
        status: order
            .as_ref()
            .map(|o| PaymentOrderStatusDto::from(o.status)),
        order: order.map(PaymentOrderDto::from),
    })))
}

pub async fn sync_order_status_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(order_no): Path<String>,
) -> Result<Json<ApiResponse<SyncOrderStatusDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let result = state
        .services
        .payment_service
        .sync_order_status(&actor, &order_no)
        .await?;

    Ok(Json(ApiResponse::success(SyncOrderStatusDto {
        paid: result.paid,
        status: if result.paid { "paid" } else { "pending" },
        trade_state: result.trade_state,
        transaction_id: result.transaction_id,
    })))
}

pub async fn list_orders_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<OrderListQuery>,
) -> Result<Json<ApiResponse<Vec<PaymentOrderDto>>>, HttpError> {
    let actor = state.actor(&headers)?;
    let orders = state
        .services
        .payment_service
        .get_user_orders(&actor, query.limit.unwrap_or(20))
        .await?;

    Ok(Json(ApiResponse::success(
        orders.into_iter().map(PaymentOrderDto::from).collect(),
    )))
}

pub async fn wx_notify_handler(
    State(state): State<AppState>,
    body: String,
) -> Result<impl IntoResponse, HttpError> {
    let payload = crate::shared::xml::parse_xml(&body);

    let return_code = payload.get("return_code").cloned().unwrap_or_default();
    let result_code = payload.get("result_code").cloned().unwrap_or_default();
    if return_code != "SUCCESS" || result_code != "SUCCESS" {
        return Ok((
            StatusCode::BAD_REQUEST,
            [(header::CONTENT_TYPE, "application/xml")],
            "FAIL".to_string(),
        ));
    }

    let order_no = payload.get("out_trade_no").cloned().unwrap_or_default();
    let transaction_id = payload.get("transaction_id").cloned().unwrap_or_default();
    let total_fee = payload
        .get("total_fee")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or_default();

    let success = state
        .services
        .payment_service
        .handle_wx_pay_notify(&order_no, &transaction_id, total_fee)
        .await?;

    if success {
        Ok((
            StatusCode::OK,
            [(header::CONTENT_TYPE, "application/xml")],
            crate::shared::xml::build_xml(&[("return_code", "SUCCESS"), ("return_msg", "OK")]),
        ))
    } else {
        Ok((
            StatusCode::BAD_REQUEST,
            [(header::CONTENT_TYPE, "application/xml")],
            "FAIL".to_string(),
        ))
    }
}

pub async fn cancel_order_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CancelOrderRequest>,
) -> Result<Json<ApiResponse<CancelOrderResultDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let success = state
        .services
        .payment_service
        .cancel_order(&actor, &payload.order_no)
        .await?;

    Ok(Json(ApiResponse::success(CancelOrderResultDto {
        success,
        message: if success {
            "订单已取消"
        } else {
            "取消订单失败"
        },
    })))
}
