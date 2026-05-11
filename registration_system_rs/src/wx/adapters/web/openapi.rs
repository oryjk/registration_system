#![allow(dead_code)]

use super::dto::{
    AccessTokenDto, PhoneNumberDto, WxLoginRequest, WxLoginResponse, WxPhoneNumberRequest,
};
use crate::shared::api_response::{ApiResponse, EmptyData};
use crate::shared::openapi::BearerSecurityAddon;
use utoipa::OpenApi;

#[utoipa::path(
    post,
    path = "/login",
    tag = "Wechat",
    request_body = WxLoginRequest,
    responses(
        (status = 200, description = "微信登录成功", body = ApiResponse<WxLoginResponse>),
        (status = 400, description = "请求错误", body = ApiResponse<EmptyData>)
    )
)]
fn wx_login_doc() {}

#[utoipa::path(
    get,
    path = "/getAccessToken",
    tag = "Wechat",
    responses(
        (status = 200, description = "获取微信 access token 成功", body = ApiResponse<AccessTokenDto>),
        (status = 400, description = "请求错误", body = ApiResponse<EmptyData>)
    )
)]
fn get_access_token_doc() {}

#[utoipa::path(
    post,
    path = "/getPhoneNumber",
    tag = "Wechat",
    request_body = WxPhoneNumberRequest,
    responses(
        (status = 200, description = "获取手机号成功", body = ApiResponse<PhoneNumberDto>),
        (status = 400, description = "请求错误", body = ApiResponse<EmptyData>)
    )
)]
fn get_phone_number_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        wx_login_doc,
        get_access_token_doc,
        get_phone_number_doc
    ),
    components(
        schemas(
            ApiResponse<WxLoginResponse>,
            ApiResponse<AccessTokenDto>,
            ApiResponse<PhoneNumberDto>,
            ApiResponse<EmptyData>,
            EmptyData,
            WxLoginRequest,
            WxLoginResponse,
            WxPhoneNumberRequest,
            AccessTokenDto,
            PhoneNumberDto
        )
    ),
    tags(
        (name = "Wechat", description = "微信基础能力")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct WxApiDoc;
