use crate::team::application::error::TeamApplicationError;
use crate::team::application::permission::TeamPermissionChecker;
use crate::team::application::read_models::TeamDetail;
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct GetTeamDetailUseCase {
    query_repository: Arc<dyn TeamQueryRepository>,
    permission_checker: TeamPermissionChecker,
}

impl GetTeamDetailUseCase {
    pub fn new(query_repository: Arc<dyn TeamQueryRepository>) -> Self {
        let permission_checker = TeamPermissionChecker::new(query_repository.clone());
        Self {
            query_repository,
            permission_checker,
        }
    }

    pub async fn get_team_detail(&self, team_id: i64) -> Result<TeamDetail, TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        let members = self
            .query_repository
            .list_members_for_management(team_id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询球队成员失败: {error}"))
            })?;

        Ok(TeamDetail { team, members })
    }

    pub async fn get_team_password_info(&self, team_id: i64) -> Result<bool, TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        Ok(team.join_password_hash.is_some())
    }
}
