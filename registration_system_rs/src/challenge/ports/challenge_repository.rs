use crate::activity::domain::Activity;
use crate::challenge::domain::{
    Challenge, ChallengeDetail, ChallengeStatus, ChallengeSummary, DomainError,
};
use async_trait::async_trait;

#[derive(Debug, Clone, Copy)]
pub struct TeamChallengeListQuery<'a> {
    pub team_id: i64,
    pub user_id: i64,
    pub keyword: Option<&'a str>,
    pub status: Option<ChallengeStatus>,
    pub include_closed: bool,
    pub limit: i64,
    pub sort: &'a str,
}

#[derive(Debug, Clone, Copy)]
pub struct AdminChallengeRepositoryQuery<'a> {
    pub accessible_team_ids: Option<&'a [i64]>,
    pub team_id: Option<i64>,
    pub viewer_user_id: Option<i64>,
    pub keyword: Option<&'a str>,
    pub status: Option<ChallengeStatus>,
    pub include_closed: bool,
    pub limit: i64,
    pub sort: &'a str,
}

#[async_trait]
pub trait ChallengeQueryRepository: Send + Sync {
    async fn find_by_id(&self, challenge_id: &str) -> Result<Option<Challenge>, DomainError>;
    async fn list_for_team(
        &self,
        query: TeamChallengeListQuery<'_>,
    ) -> Result<Vec<ChallengeSummary>, DomainError>;
    async fn list_for_admin(
        &self,
        query: AdminChallengeRepositoryQuery<'_>,
    ) -> Result<Vec<ChallengeSummary>, DomainError>;
    async fn get_detail(
        &self,
        challenge_id: &str,
        user_id: Option<i64>,
    ) -> Result<Option<ChallengeDetail>, DomainError>;
    async fn count_individual_acceptances(&self, challenge_id: &str) -> Result<i64, DomainError>;
    async fn user_has_overlapping_individual_acceptance(
        &self,
        user_id: i64,
        challenge_id: &str,
        start_time: chrono::NaiveDateTime,
        end_time: chrono::NaiveDateTime,
    ) -> Result<bool, DomainError>;
}

#[async_trait]
pub trait ChallengeCommandRepository: Send + Sync {
    async fn create(&self, challenge: &Challenge) -> Result<(), DomainError>;
    async fn accept_with_activity(
        &self,
        challenge_id: &str,
        guest_team_id: i64,
        accepted_by_user_id: i64,
        activity: &Activity,
    ) -> Result<Challenge, DomainError>;
    async fn accept_as_host_team(
        &self,
        challenge_id: &str,
        host_team_id: i64,
        accepted_by_user_id: i64,
        activity: &Activity,
    ) -> Result<Challenge, DomainError>;
    async fn accept_individual(
        &self,
        challenge_id: &str,
        user_id: i64,
    ) -> Result<Challenge, DomainError>;
    async fn cancel_individual_acceptance(
        &self,
        challenge_id: &str,
        user_id: i64,
    ) -> Result<Challenge, DomainError>;
    async fn cancel(
        &self,
        challenge_id: &str,
        cancelled_by_user_id: i64,
    ) -> Result<Challenge, DomainError>;
}
