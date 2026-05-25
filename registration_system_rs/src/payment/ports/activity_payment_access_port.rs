use crate::payment::domain::DomainError;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;

#[derive(Debug, Clone)]
pub struct ActivityPaymentAcceptance {
    pub challenge_id: String,
    pub user_id: i64,
    pub title: String,
    pub amount: Decimal,
    pub payment_status: String,
    pub payment_deadline_at: Option<NaiveDateTime>,
}

#[async_trait]
pub trait ActivityPaymentAccessPort: Send + Sync {
    async fn find_individual_acceptance(
        &self,
        challenge_id: &str,
        user_id: i64,
    ) -> Result<Option<ActivityPaymentAcceptance>, DomainError>;

    async fn attach_payment_order(
        &self,
        challenge_id: &str,
        user_id: i64,
        order_no: &str,
    ) -> Result<(), DomainError>;
}
