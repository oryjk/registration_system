#![allow(dead_code)]

use super::dto::{
    CancelOrderRequest, CancelOrderResultDto, CreateRechargeOrderRequest,
    CreateRechargeOrderResultDto, CreateTeamMembershipOrderRequest,
    CreateTeamMembershipOrderResultDto, OrderStatusDto, PaymentOrderDto, PaymentOrderStatusDto,
    SyncOrderStatusDto, WxMiniPaymentParamsDto,
};
use super::handlers::OrderListQuery;
use crate::shared::api_response::{ApiResponse, EmptyData};
use crate::shared::openapi::BearerSecurityAddon;
use utoipa::OpenApi;

#[utoipa::path(
    post,
    path = "/recharge",
    tag = "Payment",
    security(("bearer_auth" = [])),
    request_body = CreateRechargeOrderRequest,
    responses(
        (status = 200, description = "创建充值订单成功", body = ApiResponse<CreateRechargeOrderResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn create_recharge_order_doc() {}

#[utoipa::path(
    post,
    path = "/team-membership",
    tag = "Payment",
    security(("bearer_auth" = [])),
    request_body = CreateTeamMembershipOrderRequest,
    responses(
        (status = 200, description = "创建球队会员订单成功", body = ApiResponse<CreateTeamMembershipOrderResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn create_team_membership_order_doc() {}

#[utoipa::path(
    get,
    path = "/order/{order_no}",
    tag = "Payment",
    security(("bearer_auth" = [])),
    params(
        ("order_no" = String, Path, description = "订单号")
    ),
    responses(
        (status = 200, description = "查询订单状态成功", body = ApiResponse<OrderStatusDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_order_status_doc() {}

#[utoipa::path(
    post,
    path = "/sync/{order_no}",
    tag = "Payment",
    security(("bearer_auth" = [])),
    params(
        ("order_no" = String, Path, description = "订单号")
    ),
    responses(
        (status = 200, description = "同步订单状态成功", body = ApiResponse<SyncOrderStatusDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn sync_order_status_doc() {}

#[utoipa::path(
    get,
    path = "/orders",
    tag = "Payment",
    security(("bearer_auth" = [])),
    params(OrderListQuery),
    responses(
        (status = 200, description = "查询支付订单列表成功", body = ApiResponse<Vec<PaymentOrderDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn list_orders_doc() {}

#[utoipa::path(
    post,
    path = "/wx-notify",
    tag = "Payment",
    request_body(
        content = String,
        content_type = "application/xml",
        description = "微信支付回调 XML"
    ),
    responses(
        (status = 200, description = "回调处理成功", body = String, content_type = "application/xml"),
        (status = 400, description = "回调处理失败", body = String, content_type = "application/xml")
    )
)]
fn wx_notify_doc() {}

#[utoipa::path(
    post,
    path = "/cancel",
    tag = "Payment",
    security(("bearer_auth" = [])),
    request_body = CancelOrderRequest,
    responses(
        (status = 200, description = "取消订单成功", body = ApiResponse<CancelOrderResultDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn cancel_order_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        create_recharge_order_doc,
        create_team_membership_order_doc,
        get_order_status_doc,
        sync_order_status_doc,
        list_orders_doc,
        wx_notify_doc,
        cancel_order_doc
    ),
    components(
        schemas(
            ApiResponse<CreateRechargeOrderResultDto>,
            ApiResponse<CreateTeamMembershipOrderResultDto>,
            ApiResponse<OrderStatusDto>,
            ApiResponse<SyncOrderStatusDto>,
            ApiResponse<Vec<PaymentOrderDto>>,
            ApiResponse<CancelOrderResultDto>,
            ApiResponse<EmptyData>,
            EmptyData,
            CreateRechargeOrderRequest,
            CreateRechargeOrderResultDto,
            CreateTeamMembershipOrderRequest,
            CreateTeamMembershipOrderResultDto,
            CancelOrderRequest,
            CancelOrderResultDto,
            OrderStatusDto,
            PaymentOrderDto,
            PaymentOrderStatusDto,
            super::dto::PaymentOrderTypeDto,
            SyncOrderStatusDto,
            WxMiniPaymentParamsDto
        )
    ),
    tags(
        (name = "Payment", description = "微信充值支付")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct PaymentApiDoc;
