use super::TeamService;
use crate::team::application::read_models::TeamDetailForAdmin;
use crate::team::application::{TeamApplicationError, TeamPrincipal};
use crate::team::domain::TeamAdminInfo;

impl TeamService {
    pub async fn get_team_detail_for_admin(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
    ) -> Result<TeamDetailForAdmin, TeamApplicationError> {
        self.manage_admin_assignment_use_case
            .get_team_detail_for_admin(principal, team_id)
            .await
    }

    pub async fn assign_admin_to_team(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        admin_id: i64,
    ) -> Result<(), TeamApplicationError> {
        self.manage_admin_assignment_use_case
            .assign_admin_to_team(principal, team_id, admin_id)
            .await
    }

    pub async fn unassign_admin_from_team(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        admin_id: i64,
    ) -> Result<(), TeamApplicationError> {
        self.manage_admin_assignment_use_case
            .unassign_admin_from_team(principal, team_id, admin_id)
            .await
    }

    pub async fn list_team_assigned_admins(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
    ) -> Result<Vec<TeamAdminInfo>, TeamApplicationError> {
        self.manage_admin_assignment_use_case
            .list_team_assigned_admins(principal, team_id)
            .await
    }
}
