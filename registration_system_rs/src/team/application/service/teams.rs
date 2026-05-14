use super::TeamService;
use crate::team::application::commands::{CreateTeamCommand, UpdateTeamCommand};
use crate::team::application::read_models::{TeamDetail, TeamSummary};
use crate::team::application::{TeamApplicationError, TeamPrincipal};
use crate::team::domain::Team;

impl TeamService {
    pub async fn create_team(
        &self,
        principal: &TeamPrincipal,
        command: CreateTeamCommand,
    ) -> Result<Team, TeamApplicationError> {
        self.create_team_use_case
            .execute_for_user(principal, command)
            .await
    }

    pub async fn admin_create_team(
        &self,
        principal: &TeamPrincipal,
        command: CreateTeamCommand,
        captain_id: Option<i64>,
    ) -> Result<Team, TeamApplicationError> {
        self.create_team_use_case
            .execute_for_admin(principal, command, captain_id)
            .await
    }

    pub async fn admin_list_teams(
        &self,
        principal: &TeamPrincipal,
        active_only: bool,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        self.list_teams_use_case
            .admin_list_teams(principal, active_only)
            .await
    }

    pub async fn list_teams(
        &self,
        active_only: bool,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        self.list_teams_use_case.list_teams(active_only).await
    }

    pub async fn search_teams(
        &self,
        keyword: &str,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        self.list_teams_use_case.search_teams(keyword).await
    }

    pub async fn get_team_detail(&self, team_id: i64) -> Result<TeamDetail, TeamApplicationError> {
        self.get_team_detail_use_case.get_team_detail(team_id).await
    }

    pub async fn join_team(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        password: Option<&str>,
    ) -> Result<(), TeamApplicationError> {
        self.join_team_use_case
            .execute(principal, team_id, password)
            .await
    }

    pub async fn list_my_teams(
        &self,
        principal: &TeamPrincipal,
    ) -> Result<Vec<Team>, TeamApplicationError> {
        self.get_user_teams_use_case.list_my_teams(principal).await
    }

    pub async fn list_user_teams_for_target(
        &self,
        principal: &TeamPrincipal,
        target_user_id: i64,
    ) -> Result<Vec<Team>, TeamApplicationError> {
        self.get_user_teams_use_case
            .list_user_teams_for_target(principal, target_user_id)
            .await
    }

    pub async fn update_team(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: UpdateTeamCommand,
    ) -> Result<(), TeamApplicationError> {
        self.manage_team_use_case
            .update_team(principal, team_id, command)
            .await
    }

    pub async fn delete_team(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
    ) -> Result<(), TeamApplicationError> {
        self.manage_team_use_case
            .delete_team(principal, team_id)
            .await
    }

    pub async fn get_team_password_info(&self, team_id: i64) -> Result<bool, TeamApplicationError> {
        self.get_team_detail_use_case
            .get_team_password_info(team_id)
            .await
    }
}
