use crate::payment::domain::{DomainError, PaymentQueryResult, WxMiniPaymentParams};
use crate::payment::ports::WxPayGateway;
use async_trait::async_trait;
use rand::distributions::{Alphanumeric, DistString};
use rust_decimal::Decimal;

#[derive(Clone, Default)]
pub struct MockWxPayGateway;

#[async_trait]
impl WxPayGateway for MockWxPayGateway {
    async fn create_mini_pay(
        &self,
        order_no: &str,
        _description: &str,
        _amount: Decimal,
        _openid: &str,
    ) -> Result<(String, WxMiniPaymentParams), DomainError> {
        let nonce_str = Alphanumeric.sample_string(&mut rand::thread_rng(), 32);
        let time_stamp = chrono::Utc::now().timestamp().to_string();
        let prepay_id = format!("wx{order_no}");

        Ok((
            prepay_id.clone(),
            WxMiniPaymentParams {
                time_stamp,
                nonce_str,
                package: format!("prepay_id={prepay_id}"),
                sign_type: "MD5".to_string(),
                pay_sign: "mock_sign_for_testing".to_string(),
            },
        ))
    }

    async fn query_order(&self, order_no: &str) -> Result<PaymentQueryResult, DomainError> {
        Ok(PaymentQueryResult {
            paid: true,
            transaction_id: Some(format!("mock-tx-{order_no}")),
            trade_state: Some("SUCCESS".to_string()),
        })
    }
}
