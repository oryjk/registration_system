use crate::shared::error::AppError;
use crate::wx::domain::WechatAccessToken;
use crate::wx::ports::WechatApi;
use std::sync::Arc;

#[derive(Clone)]
pub struct GetWechatAccessTokenUseCase {
    api: Arc<dyn WechatApi>,
}

impl GetWechatAccessTokenUseCase {
    pub fn new(api: Arc<dyn WechatApi>) -> Self {
        Self { api }
    }

    pub async fn execute(&self) -> Result<WechatAccessToken, AppError> {
        self.api
            .get_access_token()
            .await
            .map_err(|error| AppError::internal(format!("获取微信 access_token 失败: {error}")))
    }
}
