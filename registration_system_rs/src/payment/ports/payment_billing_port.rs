use crate::payment::domain::DomainError;
use async_trait::async_trait;
use rust_decimal::Decimal;

pub struct TeamMembershipSettlement<'a> {
    pub order_no: &'a str,
    pub team_id: &'a str,
    pub user_id: i64,
    pub months: i32,
    pub amount: Decimal,
    pub credit_delta: i32,
    pub transaction_id: &'a str,
    pub note: Option<&'a str>,
}

#[async_trait]
pub trait PaymentBillingPort: Send + Sync {
    async fn apply_recharge(
        &self,
        user_id: i64,
        amount: Decimal,
        transaction_id: &str,
        description: &str,
    ) -> Result<(), DomainError>;
    async fn apply_team_membership_order(
        &self,
        settlement: TeamMembershipSettlement<'_>,
    ) -> Result<(), DomainError>;
}
