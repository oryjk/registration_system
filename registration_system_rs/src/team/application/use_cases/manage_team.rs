use crate::team::application::TeamApplicationError;
use crate::team::application::commands::UpdateTeamCommand;
use crate::team::application::permission::TeamPermissionChecker;
use crate::team::application::principal::TeamPrincipal;
use crate::team::domain::UpdateTeamFields;
use crate::team::ports::{TeamCommandRepository, TeamQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct ManageTeamUseCase {
    command_repository: Arc<dyn TeamCommandRepository>,
    permission_checker: TeamPermissionChecker,
}

impl ManageTeamUseCase {
    pub fn new(
        query_repository: Arc<dyn TeamQueryRepository>,
        command_repository: Arc<dyn TeamCommandRepository>,
    ) -> Self {
        let permission_checker = TeamPermissionChecker::new(query_repository);
        Self {
            command_repository,
            permission_checker,
        }
    }

    pub async fn update_team(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: UpdateTeamCommand,
    ) -> Result<(), TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        self.permission_checker
            .ensure_team_manager(principal, &team)
            .await?;

        let join_password_hash = match command.join_password {
            Some(Some(password)) if !password.trim().is_empty() => {
                Some(Some(bcrypt::hash(password, bcrypt::DEFAULT_COST).map_err(
                    |error| TeamApplicationError::internal(format!("加密球队密码失败: {error}")),
                )?))
            }
            Some(Some(_)) => Some(None),
            Some(None) => Some(None),
            None => None,
        };

        self.command_repository
            .update(
                team_id,
                UpdateTeamFields {
                    name: command.name.as_deref(),
                    description: command.description.as_ref().map(|value| value.as_deref()),
                    logo_url: command.logo_url.as_ref().map(|value| value.as_deref()),
                    captain_id: command.captain_id,
                    status: command.status,
                    join_password_hash: join_password_hash.as_ref().map(|value| value.as_deref()),
                },
            )
            .await
            .map_err(|error| TeamApplicationError::internal(format!("更新球队失败: {error}")))
    }

    pub async fn delete_team(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
    ) -> Result<(), TeamApplicationError> {
        if !principal.is_admin() || !principal.is_super_admin {
            return Err(TeamApplicationError::Forbidden);
        }

        self.permission_checker.get_team(team_id).await?;
        self.command_repository
            .delete(team_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("删除球队失败: {error}")))
    }
}
