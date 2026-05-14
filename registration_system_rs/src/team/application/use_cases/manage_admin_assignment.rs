use crate::team::application::TeamApplicationError;
use crate::team::application::permission::TeamPermissionChecker;
use crate::team::application::principal::TeamPrincipal;
use crate::team::application::read_models::TeamDetailForAdmin;
use crate::team::domain::TeamAdminInfo;
use crate::team::ports::{TeamCommandRepository, TeamQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct ManageTeamAdminAssignmentUseCase {
    query_repository: Arc<dyn TeamQueryRepository>,
    command_repository: Arc<dyn TeamCommandRepository>,
    permission_checker: TeamPermissionChecker,
}

impl ManageTeamAdminAssignmentUseCase {
    pub fn new(
        query_repository: Arc<dyn TeamQueryRepository>,
        command_repository: Arc<dyn TeamCommandRepository>,
    ) -> Self {
        let permission_checker = TeamPermissionChecker::new(query_repository.clone());
        Self {
            query_repository,
            command_repository,
            permission_checker,
        }
    }

    pub async fn get_team_detail_for_admin(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
    ) -> Result<TeamDetailForAdmin, TeamApplicationError> {
        if !principal.is_admin() {
            return Err(TeamApplicationError::Forbidden);
        }
        let team = self.permission_checker.get_team(team_id).await?;

        if !principal.is_super_admin {
            let assigned = self
                .query_repository
                .is_admin_assigned(team_id, principal.id)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("检查权限失败: {error}"))
                })?;
            if !assigned {
                return Err(TeamApplicationError::Forbidden);
            }
        }

        let members = self
            .query_repository
            .list_members_with_info(team_id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询球队成员失败: {error}"))
            })?;
        let assigned_admins = self
            .query_repository
            .list_team_admins_with_info(team_id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询球队管理员失败: {error}"))
            })?;

        Ok(TeamDetailForAdmin {
            team,
            members,
            assigned_admins,
        })
    }

    pub async fn assign_admin_to_team(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        admin_id: i64,
    ) -> Result<(), TeamApplicationError> {
        if !principal.is_admin() || !principal.is_super_admin {
            return Err(TeamApplicationError::Forbidden);
        }

        self.permission_checker.get_team(team_id).await?;
        self.command_repository
            .assign_admin(team_id, admin_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("分配管理员失败: {error}")))
    }

    pub async fn unassign_admin_from_team(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        admin_id: i64,
    ) -> Result<(), TeamApplicationError> {
        if !principal.is_admin() || !principal.is_super_admin {
            return Err(TeamApplicationError::Forbidden);
        }

        self.permission_checker.get_team(team_id).await?;
        self.command_repository
            .unassign_admin(team_id, admin_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("取消管理员分配失败: {error}")))
    }

    pub async fn list_team_assigned_admins(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
    ) -> Result<Vec<TeamAdminInfo>, TeamApplicationError> {
        if !principal.is_admin() {
            return Err(TeamApplicationError::Forbidden);
        }

        self.permission_checker.get_team(team_id).await?;
        self.query_repository
            .list_team_admins_with_info(team_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询球队管理员失败: {error}")))
    }
}
