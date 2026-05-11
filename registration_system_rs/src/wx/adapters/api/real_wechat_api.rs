use crate::wx::domain::{DomainError, PhoneNumberResult, WechatAccessToken, WechatLoginSession};
use crate::wx::ports::WechatApi;
use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;

#[derive(Clone)]
pub struct RealWechatApi {
    client: Client,
    app_id: String,
    app_secret: String,
}

impl RealWechatApi {
    pub fn new(app_id: impl Into<String>, app_secret: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            app_id: app_id.into(),
            app_secret: app_secret.into(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct WechatErrorResponse {
    errcode: Option<i64>,
    errmsg: Option<String>,
    openid: Option<String>,
    session_key: Option<String>,
    unionid: Option<String>,
    access_token: Option<String>,
    expires_in: Option<i64>,
    phone_info: Option<PhoneInfoResponse>,
    phone_number: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PhoneInfoResponse {
    phone_number: String,
}

#[async_trait]
impl WechatApi for RealWechatApi {
    async fn login(
        &self,
        js_code: &str,
        grant_type: &str,
    ) -> Result<WechatLoginSession, DomainError> {
        let response = self
            .client
            .get("https://api.weixin.qq.com/sns/jscode2session")
            .query(&[
                ("appid", self.app_id.as_str()),
                ("secret", self.app_secret.as_str()),
                ("js_code", js_code),
                ("grant_type", grant_type),
            ])
            .send()
            .await
            .map_err(|e| DomainError::ApiError(format!("调用微信 jscode2session 失败: {e}")))?
            .error_for_status()
            .map_err(|e| DomainError::ApiError(format!("微信 jscode2session 返回非 2xx: {e}")))?;

        let payload = response
            .json::<WechatErrorResponse>()
            .await
            .map_err(|e| DomainError::ApiError(format!("解析微信登录响应失败: {e}")))?;

        if let Some(errcode) = payload.errcode {
            return Err(DomainError::ApiError(format!(
                "微信登录错误 errcode={}, errmsg={}",
                errcode,
                payload.errmsg.unwrap_or_default()
            )));
        }

        Ok(WechatLoginSession {
            openid: payload
                .openid
                .ok_or_else(|| DomainError::ApiError("微信登录响应缺少 openid".to_string()))?,
            session_key: payload.session_key,
            unionid: payload.unionid,
        })
    }

    async fn get_access_token(&self) -> Result<WechatAccessToken, DomainError> {
        let response = self
            .client
            .get("https://api.weixin.qq.com/cgi-bin/token")
            .query(&[
                ("grant_type", "client_credential"),
                ("appid", self.app_id.as_str()),
                ("secret", self.app_secret.as_str()),
            ])
            .send()
            .await
            .map_err(|e| DomainError::ApiError(format!("调用微信 access_token 失败: {e}")))?
            .error_for_status()
            .map_err(|e| DomainError::ApiError(format!("微信 access_token 返回非 2xx: {e}")))?;

        let payload = response
            .json::<WechatErrorResponse>()
            .await
            .map_err(|e| DomainError::ApiError(format!("解析 access_token 响应失败: {e}")))?;

        if let Some(errcode) = payload.errcode {
            return Err(DomainError::ApiError(format!(
                "获取微信 access_token 错误 errcode={}, errmsg={}",
                errcode,
                payload.errmsg.unwrap_or_default()
            )));
        }

        Ok(WechatAccessToken {
            access_token: payload.access_token.ok_or_else(|| {
                DomainError::ApiError("微信 access_token 响应缺少字段".to_string())
            })?,
            expires_in: payload.expires_in.unwrap_or(7200),
        })
    }

    async fn get_phone_number(&self, code: &str) -> Result<PhoneNumberResult, DomainError> {
        let access_token = self.get_access_token().await?;
        let response = self
            .client
            .post(format!(
                "https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={}",
                access_token.access_token
            ))
            .json(&serde_json::json!({ "code": code }))
            .send()
            .await
            .map_err(|e| DomainError::ApiError(format!("调用微信 getuserphonenumber 失败: {e}")))?
            .error_for_status()
            .map_err(|e| {
                DomainError::ApiError(format!("微信 getuserphonenumber 返回非 2xx: {e}"))
            })?;

        let payload = response
            .json::<WechatErrorResponse>()
            .await
            .map_err(|e| DomainError::ApiError(format!("解析微信手机号响应失败: {e}")))?;

        if let Some(errcode) = payload.errcode {
            return Err(DomainError::ApiError(format!(
                "获取微信手机号错误 errcode={}, errmsg={}",
                errcode,
                payload.errmsg.unwrap_or_default()
            )));
        }

        let phone_number = payload
            .phone_info
            .map(|info| info.phone_number)
            .or(payload.phone_number)
            .ok_or_else(|| DomainError::ApiError("微信手机号响应缺少 phone_number".to_string()))?;

        Ok(PhoneNumberResult { phone_number })
    }
}
