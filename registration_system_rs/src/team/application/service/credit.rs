use super::TeamService;
use crate::team::application::commands::{
    SubmitActivityReviewCommand, TeamCreditPenaltyCommand, TeamMembershipRechargeCommand,
};
use crate::team::application::read_models::TeamCreditOverview;
use crate::team::application::{TeamApplicationError, TeamPrincipal};
use crate::team::domain::TeamCreditTransaction;

impl TeamService {
    pub async fn get_credit_overview(
        &self,
        team_id: i64,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        self.manage_credit_use_case
            .get_credit_overview(team_id)
            .await
    }

    pub async fn list_credit_transactions(
        &self,
        team_id: i64,
        limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, TeamApplicationError> {
        self.manage_credit_use_case
            .list_credit_transactions(team_id, limit)
            .await
    }

    pub async fn submit_activity_review(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: SubmitActivityReviewCommand,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        self.manage_credit_use_case
            .submit_activity_review(principal, team_id, command)
            .await
    }

    pub async fn recharge_membership(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: TeamMembershipRechargeCommand,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        self.manage_credit_use_case
            .recharge_membership(principal, team_id, command)
            .await
    }

    pub async fn apply_credit_penalty(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: TeamCreditPenaltyCommand,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        self.manage_credit_use_case
            .apply_credit_penalty(principal, team_id, command)
            .await
    }
}
