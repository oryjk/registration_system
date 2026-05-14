use crate::shared::error::AppError;
use crate::wx::domain::WechatLoginSession;
use crate::wx::ports::WechatApi;
use std::sync::Arc;

#[derive(Clone)]
pub struct WechatLoginUseCase {
    api: Arc<dyn WechatApi>,
}

impl WechatLoginUseCase {
    pub fn new(api: Arc<dyn WechatApi>) -> Self {
        Self { api }
    }

    pub async fn execute(
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
}
