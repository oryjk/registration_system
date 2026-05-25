use crate::team::domain::{
    ActivityTeamReview, DomainError, Team, TeamAdminInfo, TeamAttendanceRankingItem,
    TeamCreditTransaction, TeamMember, TeamMemberAttendanceRecord, TeamMemberWithInfo,
    UpdateTeamFields,
};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;

pub struct ActivityReviewRecord<'a> {
    pub activity_id: &'a str,
    pub reviewer_team_id: i64,
    pub reviewer_user_id: i64,
    pub reviewee_team_id: i64,
    pub rating: i8,
    pub credit_delta: i32,
    pub comment: Option<&'a str>,
    pub score_before: i32,
    pub score_after: i32,
}

pub struct MembershipRechargeRecord<'a> {
    pub team_id: i64,
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
pub trait TeamQueryRepository: Send + Sync {
    async fn find_by_id(&self, team_id: i64) -> Result<Option<Team>, DomainError>;
    async fn find_by_name(&self, name: &str) -> Result<Option<Team>, DomainError>;
    async fn list(&self, active_only: bool) -> Result<Vec<Team>, DomainError>;
    async fn search(&self, keyword: &str) -> Result<Vec<Team>, DomainError>;
    async fn is_member(&self, team_id: i64, user_id: i64) -> Result<bool, DomainError>;
    async fn get_member_status(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<i8>, DomainError>;
    async fn list_members(&self, team_id: i64) -> Result<Vec<TeamMember>, DomainError>;
    async fn list_members_for_management(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamMember>, DomainError>;
    async fn list_member_attendance_records(
        &self,
        team_id: i64,
        user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<TeamMemberAttendanceRecord>, DomainError>;
    async fn list_team_attendance_ranking(
        &self,
        team_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<TeamAttendanceRankingItem>, DomainError>;
    async fn list_user_teams(&self, user_id: i64) -> Result<Vec<Team>, DomainError>;
    async fn list_members_with_info(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamMemberWithInfo>, DomainError>;
    async fn list_team_admins_with_info(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamAdminInfo>, DomainError>;
    async fn is_admin_assigned(&self, team_id: i64, admin_id: i64) -> Result<bool, DomainError>;
    async fn list_teams_by_admin(&self, admin_id: i64) -> Result<Vec<Team>, DomainError>;
    async fn list_credit_transactions(
        &self,
        team_id: i64,
        limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, DomainError>;
    async fn find_activity_review(
        &self,
        activity_id: &str,
        reviewer_team_id: i64,
    ) -> Result<Option<ActivityTeamReview>, DomainError>;
}

#[async_trait]
pub trait TeamCommandRepository: Send + Sync {
    async fn create(&self, team: &Team) -> Result<Team, DomainError>;
    async fn update(&self, team_id: i64, fields: UpdateTeamFields<'_>) -> Result<(), DomainError>;
    async fn delete(&self, team_id: i64) -> Result<(), DomainError>;
    async fn set_captain_member(&self, team_id: i64, user_id: i64) -> Result<(), DomainError>;
    async fn add_member(
        &self,
        team_id: i64,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
        is_member: bool,
    ) -> Result<(), DomainError>;
    async fn reactivate_member(
        &self,
        team_id: i64,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
        is_member: bool,
    ) -> Result<(), DomainError>;
    async fn remove_member(&self, team_id: i64, user_id: i64) -> Result<(), DomainError>;
    async fn batch_remove_members(
        &self,
        team_id: i64,
        user_ids: &[i64],
    ) -> Result<u64, DomainError>;
    async fn update_member(
        &self,
        team_id: i64,
        user_id: i64,
        role: Option<&str>,
        jersey_number: Option<Option<&str>>,
        is_member: Option<bool>,
    ) -> Result<(), DomainError>;
    async fn batch_update_member_status(
        &self,
        team_id: i64,
        user_ids: &[i64],
        status: i8,
    ) -> Result<u64, DomainError>;
    async fn assign_admin(&self, team_id: i64, admin_id: i64) -> Result<(), DomainError>;
    async fn unassign_admin(&self, team_id: i64, admin_id: i64) -> Result<(), DomainError>;
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
        team_id: i64,
        admin_id: i64,
        points: i32,
        reason: &str,
        score_before: i32,
        score_after: i32,
    ) -> Result<Team, DomainError>;
}
