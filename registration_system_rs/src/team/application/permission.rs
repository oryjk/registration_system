use crate::team::application::error::TeamApplicationError;
use crate::team::application::principal::{TeamPrincipal, TeamRole};
use crate::team::domain::Team;
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct TeamPermissionChecker {
    query_repository: Arc<dyn TeamQueryRepository>,
}

impl TeamPermissionChecker {
    pub fn new(query_repository: Arc<dyn TeamQueryRepository>) -> Self {
        Self { query_repository }
    }

    pub async fn get_team(&self, team_id: i64) -> Result<Team, TeamApplicationError> {
        self.query_repository
            .find_by_id(team_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询球队失败: {error}")))?
            .ok_or_else(|| TeamApplicationError::NotFound("球队不存在".to_string()))
    }

    pub async fn ensure_team_manager(
        &self,
        principal: &TeamPrincipal,
        team: &Team,
    ) -> Result<(), TeamApplicationError> {
        if principal.role == TeamRole::Admin {
            if principal.is_super_admin {
                return Ok(());
            }

            let assigned = self
                .query_repository
                .is_admin_assigned(team.id, principal.id)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("检查管理员权限失败: {error}"))
                })?;

            return if assigned {
                Ok(())
            } else {
                Err(TeamApplicationError::Forbidden)
            };
        }

        if principal.role == TeamRole::User && team.captain_id == Some(principal.id) {
            return Ok(());
        }

        Err(TeamApplicationError::Forbidden)
    }

    pub async fn ensure_team_member_or_manager(
        &self,
        principal: &TeamPrincipal,
        team: &Team,
    ) -> Result<(), TeamApplicationError> {
        if self.ensure_team_manager(principal, team).await.is_ok() {
            return Ok(());
        }

        if principal.role != TeamRole::User {
            return Err(TeamApplicationError::Forbidden);
        }

        let member_status = self
            .query_repository
            .get_member_status(team.id, principal.id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("检查队员状态失败: {error}"))
            })?;

        if member_status == Some(1) {
            Ok(())
        } else {
            Err(TeamApplicationError::Forbidden)
        }
    }
}
