use async_trait::async_trait;

#[async_trait]
pub trait ActivityTeamAccessPort: Send + Sync {
    async fn find_active_member_role(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<String>, String>;
}
