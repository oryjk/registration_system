use crate::shared::error::AppError;
use crate::wx::domain::PhoneNumberResult;
use crate::wx::ports::WechatApi;
use std::sync::Arc;

#[derive(Clone)]
pub struct GetWechatPhoneNumberUseCase {
    api: Arc<dyn WechatApi>,
}

impl GetWechatPhoneNumberUseCase {
    pub fn new(api: Arc<dyn WechatApi>) -> Self {
        Self { api }
    }

    pub async fn execute(&self, code: &str) -> Result<PhoneNumberResult, AppError> {
        if code.trim().is_empty() {
            return Err(AppError::Validation("code 不能为空".to_string()));
        }

        self.api
            .get_phone_number(code)
            .await
            .map_err(|error| AppError::internal(format!("获取微信手机号失败: {error}")))
    }
}
