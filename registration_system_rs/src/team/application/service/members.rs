use super::TeamService;
use crate::team::application::commands::{AddTeamMemberCommand, UpdateTeamMemberCommand};
use crate::team::application::{TeamApplicationError, TeamPrincipal};

impl TeamService {
    pub async fn add_member(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: AddTeamMemberCommand,
    ) -> Result<(), TeamApplicationError> {
        self.manage_member_use_case
            .add_member(principal, team_id, command)
            .await
    }

    pub async fn remove_member(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        target_user_id: i64,
    ) -> Result<(), TeamApplicationError> {
        self.manage_member_use_case
            .remove_member(principal, team_id, target_user_id)
            .await
    }

    pub async fn batch_remove_members(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        user_ids: &[i64],
    ) -> Result<u64, TeamApplicationError> {
        self.manage_member_use_case
            .batch_remove_members(principal, team_id, user_ids)
            .await
    }

    pub async fn batch_update_member_status(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        user_ids: &[i64],
        status: i8,
    ) -> Result<u64, TeamApplicationError> {
        self.manage_member_use_case
            .batch_update_member_status(principal, team_id, user_ids, status)
            .await
    }

    pub async fn update_member(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        target_user_id: i64,
        command: UpdateTeamMemberCommand,
    ) -> Result<(), TeamApplicationError> {
        self.manage_member_use_case
            .update_member(principal, team_id, target_user_id, command)
            .await
    }
}
