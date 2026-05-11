use crate::payment::domain::{DomainError, PaymentQueryResult, WxMiniPaymentParams};
use crate::payment::ports::WxPayGateway;
use async_trait::async_trait;
use rand::distributions::{Alphanumeric, DistString};
use regex::Regex;
use reqwest::Client;
use rust_decimal::Decimal;
use std::collections::HashMap;

#[derive(Clone)]
pub struct RealWxPayGateway {
    client: Client,
    app_id: String,
    mch_id: String,
    api_key: String,
    api_base_url: String,
    notify_url: String,
}

impl RealWxPayGateway {
    pub fn new(
        app_id: impl Into<String>,
        mch_id: impl Into<String>,
        api_key: impl Into<String>,
        api_base_url: impl Into<String>,
        notify_url: impl Into<String>,
    ) -> Self {
        Self {
            client: Client::new(),
            app_id: app_id.into(),
            mch_id: mch_id.into(),
            api_key: api_key.into(),
            api_base_url: api_base_url.into(),
            notify_url: notify_url.into(),
        }
    }

    fn nonce_str(&self) -> String {
        Alphanumeric.sample_string(&mut rand::thread_rng(), 32)
    }

    fn time_stamp(&self) -> String {
        chrono::Utc::now().timestamp().to_string()
    }

    fn md5_hex_upper(&self, input: &str) -> String {
        format!("{:x}", md5::compute(input)).to_uppercase()
    }

    fn object_to_sorted_string(&self, pairs: &HashMap<&str, String>) -> String {
        let mut items: Vec<(&str, &String)> = pairs
            .iter()
            .filter(|(_, v)| !v.is_empty())
            .map(|(k, v)| (*k, v))
            .collect();
        items.sort_by(|a, b| a.0.cmp(b.0));
        items
            .into_iter()
            .map(|(k, v)| format!("{k}={v}"))
            .collect::<Vec<_>>()
            .join("&")
    }

    fn build_xml(&self, pairs: &HashMap<&str, String>) -> String {
        let mut xml = String::from("<xml>");
        let mut keys: Vec<&str> = pairs.keys().copied().collect();
        keys.sort();
        for key in keys {
            let value = pairs.get(key).cloned().unwrap_or_default();
            xml.push_str(&format!("<{key}><![CDATA[{value}]]></{key}>"));
        }
        xml.push_str("</xml>");
        xml
    }

    fn parse_xml(&self, xml: &str) -> HashMap<String, String> {
        let regex = Regex::new(r"<([^>/]+)>(?:<!\[CDATA\[(.*?)\]\]>|([^<]*))</[^>]+>").unwrap();
        regex
            .captures_iter(xml)
            .map(|cap| {
                let key = cap.get(1).map(|m| m.as_str()).unwrap_or_default();
                let value = cap
                    .get(2)
                    .or_else(|| cap.get(3))
                    .map(|m| m.as_str())
                    .unwrap_or_default();
                (key.to_string(), value.to_string())
            })
            .collect()
    }
}

#[async_trait]
impl WxPayGateway for RealWxPayGateway {
    async fn create_mini_pay(
        &self,
        order_no: &str,
        description: &str,
        amount: Decimal,
        openid: &str,
    ) -> Result<(String, WxMiniPaymentParams), DomainError> {
        if openid.trim().is_empty() {
            return Err(DomainError::Infrastructure(
                "真实微信支付模式下 openid 不能为空".to_string(),
            ));
        }

        let nonce_str = self.nonce_str();
        let time_stamp = self.time_stamp();
        let mut request_body = HashMap::from([
            ("appid", self.app_id.clone()),
            ("mch_id", self.mch_id.clone()),
            ("body", description.to_string()),
            ("out_trade_no", order_no.to_string()),
            (
                "total_fee",
                (amount * Decimal::new(100, 0)).round().to_string(),
            ),
            ("spbill_create_ip", "127.0.0.1".to_string()),
            ("notify_url", self.notify_url.clone()),
            ("openid", openid.to_string()),
            ("trade_type", "JSAPI".to_string()),
            ("nonce_str", nonce_str.clone()),
        ]);

        let sign_input = format!(
            "{}&key={}",
            self.object_to_sorted_string(&request_body),
            self.api_key
        );
        request_body.insert("sign", self.md5_hex_upper(&sign_input));

        let response = self
            .client
            .post(format!("{}/pay/unifiedorder", self.api_base_url))
            .header("content-type", "application/xml")
            .body(self.build_xml(&request_body))
            .send()
            .await
            .map_err(|e| DomainError::Infrastructure(format!("调用微信 unifiedorder 失败: {e}")))?
            .error_for_status()
            .map_err(|e| {
                DomainError::Infrastructure(format!("微信 unifiedorder 返回非 2xx: {e}"))
            })?;

        let xml_text = response
            .text()
            .await
            .map_err(|e| DomainError::Infrastructure(format!("读取 unifiedorder 响应失败: {e}")))?;
        let result = self.parse_xml(&xml_text);

        if result.get("return_code").map(String::as_str) != Some("SUCCESS") {
            return Err(DomainError::Infrastructure(format!(
                "微信下单失败: {}",
                result.get("return_msg").cloned().unwrap_or_default()
            )));
        }
        if result.get("result_code").map(String::as_str) != Some("SUCCESS") {
            return Err(DomainError::Infrastructure(format!(
                "微信下单失败: {}",
                result.get("err_code_des").cloned().unwrap_or_default()
            )));
        }

        let prepay_id = result
            .get("prepay_id")
            .cloned()
            .ok_or_else(|| DomainError::Infrastructure("微信下单响应缺少 prepay_id".to_string()))?;

        let package = format!("prepay_id={prepay_id}");
        let pay_sign_input = format!(
            "appId={}&nonceStr={}&package={}&signType=MD5&timeStamp={}&key={}",
            self.app_id, nonce_str, package, time_stamp, self.api_key
        );

        Ok((
            prepay_id,
            WxMiniPaymentParams {
                time_stamp,
                nonce_str,
                package,
                sign_type: "MD5".to_string(),
                pay_sign: self.md5_hex_upper(&pay_sign_input),
            },
        ))
    }

    async fn query_order(&self, order_no: &str) -> Result<PaymentQueryResult, DomainError> {
        let nonce_str = self.nonce_str();
        let mut request_body = HashMap::from([
            ("appid", self.app_id.clone()),
            ("mch_id", self.mch_id.clone()),
            ("out_trade_no", order_no.to_string()),
            ("nonce_str", nonce_str),
        ]);
        let sign_input = format!(
            "{}&key={}",
            self.object_to_sorted_string(&request_body),
            self.api_key
        );
        request_body.insert("sign", self.md5_hex_upper(&sign_input));

        let response = self
            .client
            .post(format!("{}/pay/orderquery", self.api_base_url))
            .header("content-type", "application/xml")
            .body(self.build_xml(&request_body))
            .send()
            .await
            .map_err(|e| DomainError::Infrastructure(format!("调用微信 orderquery 失败: {e}")))?
            .error_for_status()
            .map_err(|e| DomainError::Infrastructure(format!("微信 orderquery 返回非 2xx: {e}")))?;

        let xml_text = response
            .text()
            .await
            .map_err(|e| DomainError::Infrastructure(format!("读取 orderquery 响应失败: {e}")))?;
        let result = self.parse_xml(&xml_text);
        let trade_state = result.get("trade_state").cloned();

        Ok(PaymentQueryResult {
            paid: trade_state.as_deref() == Some("SUCCESS"),
            transaction_id: result.get("transaction_id").cloned(),
            trade_state,
        })
    }
}
