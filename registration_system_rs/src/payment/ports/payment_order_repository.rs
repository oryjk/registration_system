use crate::payment::domain::{
    DomainError, PaymentOrder, PaymentOrderStatus, TeamMembershipPaymentOrder,
};
use async_trait::async_trait;

#[async_trait]
pub trait PaymentOrderRepository: Send + Sync {
    async fn create(&self, order: &PaymentOrder) -> Result<i64, DomainError>;
    async fn find_by_order_no(&self, order_no: &str) -> Result<Option<PaymentOrder>, DomainError>;
    async fn find_by_user_id(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<PaymentOrder>, DomainError>;
    async fn update_status(
        &self,
        order_no: &str,
        status: PaymentOrderStatus,
    ) -> Result<(), DomainError>;
    async fn update_payment_info(
        &self,
        order_no: &str,
        prepay_id: &str,
        transaction_id: Option<&str>,
    ) -> Result<(), DomainError>;
    async fn mark_as_paid(
        &self,
        order_no: &str,
        transaction_id: &str,
        paid_at: chrono::NaiveDateTime,
    ) -> Result<(), DomainError>;
    async fn create_team_membership_order(
        &self,
        order: &TeamMembershipPaymentOrder,
    ) -> Result<i64, DomainError>;
    async fn find_team_membership_order(
        &self,
        order_no: &str,
    ) -> Result<Option<TeamMembershipPaymentOrder>, DomainError>;
}
