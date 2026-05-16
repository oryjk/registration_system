use crate::wx::domain::{DomainError, PhoneNumberResult, WechatAccessToken, WechatLoginSession};
use crate::wx::ports::WechatApi;
use async_trait::async_trait;
use reqwest::Client;
use reqwest::Response;
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

const WECHAT_RESPONSE_SNIPPET_MAX_CHARS: usize = 500;

#[derive(Debug, Deserialize)]
struct WechatResponse {
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
#[serde(rename_all = "camelCase")]
struct PhoneInfoResponse {
    phone_number: String,
}

async fn decode_wechat_response(
    response: Response,
    context: &str,
) -> Result<WechatResponse, DomainError> {
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("-")
        .to_string();
    let body = response
        .text()
        .await
        .map_err(|e| DomainError::ApiError(format!("读取{context}响应失败: {e}")))?;

    parse_wechat_response(&body, context, &status.to_string(), &content_type)
}

fn parse_wechat_response(
    body: &str,
    context: &str,
    status: &str,
    content_type: &str,
) -> Result<WechatResponse, DomainError> {
    serde_json::from_str::<WechatResponse>(body).map_err(|e| {
        DomainError::ApiError(format!(
            "解析{context}响应失败: {e}; status={status}; content_type={content_type}; body={}",
            summarize_body(body)
        ))
    })
}

fn summarize_body(body: &str) -> String {
    let mut snippet: String = body
        .chars()
        .flat_map(|ch| ch.escape_default())
        .take(WECHAT_RESPONSE_SNIPPET_MAX_CHARS)
        .collect();
    if body.chars().count() > WECHAT_RESPONSE_SNIPPET_MAX_CHARS {
        snippet.push_str("...");
    }
    snippet
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
            .json::<WechatResponse>()
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
            .json::<WechatResponse>()
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

        let payload = decode_wechat_response(response, "微信手机号").await?;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_wechat_phone_response_error_keeps_upstream_body_summary() {
        let error = parse_wechat_response(
            "<html>bad gateway</html>",
            "微信手机号",
            "200 OK",
            "text/html",
        )
        .expect_err("html response should not decode as wechat json");

        let message = error.to_string();
        assert!(message.contains("解析微信手机号响应失败"));
        assert!(message.contains("status=200 OK"));
        assert!(message.contains("content_type=text/html"));
        assert!(message.contains("body=<html>bad gateway</html>"));
    }

    #[test]
    fn parse_wechat_phone_response_accepts_phone_info_payload() {
        let payload = parse_wechat_response(
            r#"{"errcode":0,"phone_info":{"phoneNumber":"13800138000","purePhoneNumber":"13800138000","countryCode":"86"}}"#,
            "微信手机号",
            "200 OK",
            "application/json",
        )
        .expect("official wechat phone_info payload should decode");

        assert_eq!(
            payload.phone_info.map(|info| info.phone_number),
            Some("13800138000".to_string())
        );
    }
}
