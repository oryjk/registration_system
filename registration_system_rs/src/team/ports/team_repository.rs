use crate::team::domain::{
    ActivityTeamReview, DomainError, Team, TeamAdminInfo, TeamCreditTransaction, TeamMember,
    TeamMemberWithInfo, UpdateTeamFields,
};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;

pub struct ActivityReviewRecord<'a> {
    pub activity_id: &'a str,
    pub reviewer_team_id: &'a str,
    pub reviewer_user_id: i64,
    pub reviewee_team_id: &'a str,
    pub rating: i8,
    pub credit_delta: i32,
    pub comment: Option<&'a str>,
    pub score_before: i32,
    pub score_after: i32,
}

pub struct MembershipRechargeRecord<'a> {
    pub team_id: &'a str,
    pub operator_user_id: i64,
    pub months: i32,
    pub amount: Decimal,
    pub credit_delta: i32,
    pub vip_until: NaiveDateTime,
    pub note: Option<&'a str>,
    pub score_before: i32,
    pub score_after: i32,
}

#[async_trait]
pub trait TeamRepository: Send + Sync {
    async fn create(&self, team: &Team) -> Result<(), DomainError>;
    async fn find_by_id(&self, team_id: &str) -> Result<Option<Team>, DomainError>;
    async fn find_by_name(&self, name: &str) -> Result<Option<Team>, DomainError>;
    async fn list(&self, active_only: bool) -> Result<Vec<Team>, DomainError>;
    async fn search(&self, keyword: &str) -> Result<Vec<Team>, DomainError>;
    async fn update(&self, team_id: &str, fields: UpdateTeamFields<'_>) -> Result<(), DomainError>;
    async fn delete(&self, team_id: &str) -> Result<(), DomainError>;
    async fn add_member(
        &self,
        team_id: &str,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
    ) -> Result<(), DomainError>;
    async fn reactivate_member(
        &self,
        team_id: &str,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
    ) -> Result<(), DomainError>;
    async fn remove_member(&self, team_id: &str, user_id: i64) -> Result<(), DomainError>;
    async fn batch_remove_members(
        &self,
        team_id: &str,
        user_ids: &[i64],
    ) -> Result<u64, DomainError>;
    async fn update_member(
        &self,
        team_id: &str,
        user_id: i64,
        role: Option<&str>,
        jersey_number: Option<Option<&str>>,
    ) -> Result<(), DomainError>;
    async fn batch_update_member_status(
        &self,
        team_id: &str,
        user_ids: &[i64],
        status: i8,
    ) -> Result<u64, DomainError>;
    async fn is_member(&self, team_id: &str, user_id: i64) -> Result<bool, DomainError>;
    async fn get_member_status(
        &self,
        team_id: &str,
        user_id: i64,
    ) -> Result<Option<i8>, DomainError>;
    async fn list_members(&self, team_id: &str) -> Result<Vec<TeamMember>, DomainError>;
    async fn list_user_teams(&self, user_id: i64) -> Result<Vec<Team>, DomainError>;
    /// 管理后台：查询队员列表（含球员信息）
    async fn list_members_with_info(
        &self,
        team_id: &str,
    ) -> Result<Vec<TeamMemberWithInfo>, DomainError>;

    // ─── 球队管理员分配 ───

    /// 为球队指定一名管理员
    async fn assign_admin(&self, team_id: &str, admin_id: i64) -> Result<(), DomainError>;
    /// 取消球队管理员分配
    async fn unassign_admin(&self, team_id: &str, admin_id: i64) -> Result<(), DomainError>;
    /// 查询球队的后台管理员列表（含用户名/昵称）
    async fn list_team_admins_with_info(
        &self,
        team_id: &str,
    ) -> Result<Vec<TeamAdminInfo>, DomainError>;
    /// 检查某管理员是否被分配到某球队
    async fn is_admin_assigned(&self, team_id: &str, admin_id: i64) -> Result<bool, DomainError>;
    /// 查询某管理员被分配管理的所有球队
    async fn list_teams_by_admin(&self, admin_id: i64) -> Result<Vec<Team>, DomainError>;

    async fn list_credit_transactions(
        &self,
        team_id: &str,
        limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, DomainError>;
    async fn find_activity_review(
        &self,
        activity_id: &str,
        reviewer_team_id: &str,
    ) -> Result<Option<ActivityTeamReview>, DomainError>;
    async fn record_activity_review(
        &self,
        record: ActivityReviewRecord<'_>,
    ) -> Result<Team, DomainError>;
    async fn record_membership_recharge(
        &self,
        record: MembershipRechargeRecord<'_>,
    ) -> Result<Team, DomainError>;
    async fn record_credit_penalty(
        &self,
        team_id: &str,
        admin_id: i64,
        points: i32,
        reason: &str,
        score_before: i32,
        score_after: i32,
    ) -> Result<Team, DomainError>;
}
