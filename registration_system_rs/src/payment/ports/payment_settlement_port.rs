use crate::payment::domain::DomainError;
use async_trait::async_trait;
use rust_decimal::Decimal;

pub struct RechargePaymentSettlement<'a> {
    pub order_no: &'a str,
    pub user_id: i64,
    pub amount: Decimal,
    pub transaction_id: &'a str,
    pub description: &'a str,
}

pub struct TeamMembershipPaymentSettlement<'a> {
    pub order_no: &'a str,
    pub team_id: i64,
    pub user_id: i64,
    pub months: i32,
    pub amount: Decimal,
    pub credit_delta: i32,
    pub transaction_id: &'a str,
    pub note: Option<&'a str>,
}

#[async_trait]
pub trait PaymentSettlementPort: Send + Sync {
    async fn settle_recharge_payment(
        &self,
        settlement: RechargePaymentSettlement<'_>,
    ) -> Result<(), DomainError>;

    async fn settle_team_membership_payment(
        &self,
        settlement: TeamMembershipPaymentSettlement<'_>,
    ) -> Result<(), DomainError>;
}
