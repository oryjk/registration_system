use crate::bootstrap::app::AppState;
use crate::shared::api_response::ApiResponse;
use crate::shared::http_error::HttpError;
use crate::wx::adapters::web::dto::{
    AccessTokenDto, PhoneNumberDto, WxLoginRequest, WxLoginResponse, WxPhoneNumberRequest,
};
use axum::Json;
use axum::extract::State;

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<WxLoginRequest>,
) -> Result<Json<ApiResponse<WxLoginResponse>>, HttpError> {
    let session = state
        .services
        .wx_service
        .login(&payload.js_code, payload.grant_type.as_deref())
        .await?;

    Ok(Json(ApiResponse::success(WxLoginResponse {
        openid: session.openid,
        session_key: session.session_key,
        unionid: session.unionid,
    })))
}

pub async fn get_access_token_handler(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<AccessTokenDto>>, HttpError> {
    let token = state.services.wx_service.get_access_token().await?;
    Ok(Json(ApiResponse::success(AccessTokenDto::from(token))))
}

pub async fn get_phone_number_handler(
    State(state): State<AppState>,
    Json(payload): Json<WxPhoneNumberRequest>,
) -> Result<Json<ApiResponse<PhoneNumberDto>>, HttpError> {
    let result = state
        .services
        .wx_service
        .get_phone_number(&payload.code)
        .await?;
    Ok(Json(ApiResponse::success(PhoneNumberDto::from(result))))
}
