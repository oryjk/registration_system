use crate::wx::domain::{DomainError, PhoneNumberResult, WechatAccessToken, WechatLoginSession};
use async_trait::async_trait;

#[async_trait]
pub trait WechatApi: Send + Sync {
    async fn login(
        &self,
        js_code: &str,
        grant_type: &str,
    ) -> Result<WechatLoginSession, DomainError>;
    async fn get_access_token(&self) -> Result<WechatAccessToken, DomainError>;
    async fn get_phone_number(&self, code: &str) -> Result<PhoneNumberResult, DomainError>;
}
