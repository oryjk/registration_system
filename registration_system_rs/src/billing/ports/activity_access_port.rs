use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct ActivitySettlementAccess {
    pub activity_id: String,
    pub home_team_id: Option<i64>,
    pub away_team_id: Option<i64>,
}

#[async_trait]
pub trait BillingActivityAccessPort: Send + Sync {
    async fn find_activity_settlement_access(
        &self,
        activity_id: &str,
    ) -> Result<Option<ActivitySettlementAccess>, String>;

    async fn find_active_member_role(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<String>, String>;
}
