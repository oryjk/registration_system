use crate::wx::domain::{PhoneNumberResult, WechatAccessToken};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct WxLoginRequest {
    pub js_code: String,
    pub grant_type: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct WxPhoneNumberRequest {
    pub code: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WxLoginResponse {
    pub openid: String,
    pub session_key: Option<String>,
    pub unionid: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AccessTokenDto {
    pub access_token: String,
    pub expires_in: i64,
}

impl From<WechatAccessToken> for AccessTokenDto {
    fn from(value: WechatAccessToken) -> Self {
        Self {
            access_token: value.access_token,
            expires_in: value.expires_in,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PhoneNumberDto {
    pub phone_number: String,
}

impl From<PhoneNumberResult> for PhoneNumberDto {
    fn from(value: PhoneNumberResult) -> Self {
        Self {
            phone_number: value.phone_number,
        }
    }
}
