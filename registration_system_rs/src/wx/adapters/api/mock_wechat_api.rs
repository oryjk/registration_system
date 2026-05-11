use crate::wx::domain::{DomainError, PhoneNumberResult, WechatAccessToken, WechatLoginSession};
use crate::wx::ports::WechatApi;
use async_trait::async_trait;

#[derive(Clone)]
pub struct MockWechatApi {
    mock_phone_number: String,
}

impl MockWechatApi {
    pub fn new(mock_phone_number: impl Into<String>) -> Self {
        Self {
            mock_phone_number: mock_phone_number.into(),
        }
    }
}

#[async_trait]
impl WechatApi for MockWechatApi {
    async fn login(
        &self,
        js_code: &str,
        _grant_type: &str,
    ) -> Result<WechatLoginSession, DomainError> {
        Ok(WechatLoginSession {
            openid: format!("mock-openid-{js_code}"),
            session_key: Some("mock-session-key".to_string()),
            unionid: Some("mock-union-id".to_string()),
        })
    }

    async fn get_access_token(&self) -> Result<WechatAccessToken, DomainError> {
        Ok(WechatAccessToken {
            access_token: "mock_access_token".to_string(),
            expires_in: 7200,
        })
    }

    async fn get_phone_number(&self, _code: &str) -> Result<PhoneNumberResult, DomainError> {
        Ok(PhoneNumberResult {
            phone_number: self.mock_phone_number.clone(),
        })
    }
}
