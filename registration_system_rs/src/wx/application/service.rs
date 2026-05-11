use crate::shared::error::AppError;
use crate::wx::domain::{PhoneNumberResult, WechatAccessToken, WechatLoginSession};
use crate::wx::ports::WechatApi;
use std::sync::Arc;

#[derive(Clone)]
pub struct WxService {
    api: Arc<dyn WechatApi>,
}

impl WxService {
    pub fn new(api: Arc<dyn WechatApi>) -> Self {
        Self { api }
    }

    pub async fn login(
        &self,
        js_code: &str,
        grant_type: Option<&str>,
    ) -> Result<WechatLoginSession, AppError> {
        if js_code.trim().is_empty() {
            return Err(AppError::Validation("js_code 不能为空".to_string()));
        }

        self.api
            .login(js_code, grant_type.unwrap_or("authorization_code"))
            .await
            .map_err(|error| AppError::internal(format!("微信登录失败: {error}")))
    }

    pub async fn get_access_token(&self) -> Result<WechatAccessToken, AppError> {
        self.api
            .get_access_token()
            .await
            .map_err(|error| AppError::internal(format!("获取微信 access_token 失败: {error}")))
    }

    pub async fn get_phone_number(&self, code: &str) -> Result<PhoneNumberResult, AppError> {
        if code.trim().is_empty() {
            return Err(AppError::Validation("code 不能为空".to_string()));
        }

        self.api
            .get_phone_number(code)
            .await
            .map_err(|error| AppError::internal(format!("获取微信手机号失败: {error}")))
    }
}
