use crate::payment::domain::{DomainError, PaymentQueryResult, WxMiniPaymentParams};
use async_trait::async_trait;
use rust_decimal::Decimal;

#[async_trait]
pub trait WxPayGateway: Send + Sync {
    async fn create_mini_pay(
        &self,
        order_no: &str,
        description: &str,
        amount: Decimal,
        openid: &str,
    ) -> Result<(String, WxMiniPaymentParams), DomainError>;

    async fn query_order(&self, order_no: &str) -> Result<PaymentQueryResult, DomainError>;
}
