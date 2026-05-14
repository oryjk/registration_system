use crate::shared::error::AppError;
use crate::wx::application::use_cases::{
    GetWechatAccessTokenUseCase, GetWechatPhoneNumberUseCase, WechatLoginUseCase,
};
use crate::wx::domain::{PhoneNumberResult, WechatAccessToken, WechatLoginSession};
use crate::wx::ports::WechatApi;
use std::sync::Arc;

#[derive(Clone)]
pub struct WxService {
    login_use_case: WechatLoginUseCase,
    get_access_token_use_case: GetWechatAccessTokenUseCase,
    get_phone_number_use_case: GetWechatPhoneNumberUseCase,
}

impl WxService {
    pub fn new(api: Arc<dyn WechatApi>) -> Self {
        Self {
            login_use_case: WechatLoginUseCase::new(api.clone()),
            get_access_token_use_case: GetWechatAccessTokenUseCase::new(api.clone()),
            get_phone_number_use_case: GetWechatPhoneNumberUseCase::new(api),
        }
    }

    pub async fn login(
        &self,
        js_code: &str,
        grant_type: Option<&str>,
    ) -> Result<WechatLoginSession, AppError> {
        self.login_use_case.execute(js_code, grant_type).await
    }

    pub async fn get_access_token(&self) -> Result<WechatAccessToken, AppError> {
        self.get_access_token_use_case.execute().await
    }

    pub async fn get_phone_number(&self, code: &str) -> Result<PhoneNumberResult, AppError> {
        self.get_phone_number_use_case.execute(code).await
    }
}
