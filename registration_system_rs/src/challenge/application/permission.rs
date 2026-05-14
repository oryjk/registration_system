use crate::shared::error::AppError;
use crate::team::domain::Team;
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct ChallengeTeamAccessChecker {
    team_repository: Arc<dyn TeamQueryRepository>,
}

impl ChallengeTeamAccessChecker {
    pub fn new(team_repository: Arc<dyn TeamQueryRepository>) -> Self {
        Self { team_repository }
    }

    pub async fn get_team(
        &self,
        team_id: i64,
        query_error_context: &str,
        not_found_message: &str,
    ) -> Result<Team, AppError> {
        self.team_repository
            .find_by_id(team_id)
            .await
            .map_err(|error| AppError::internal(format!("{query_error_context}: {error}")))?
            .ok_or_else(|| AppError::NotFound(not_found_message.to_string()))
    }

    pub async fn is_team_manager(&self, team_id: i64, user_id: i64) -> Result<bool, AppError> {
        let team = self
            .team_repository
            .find_by_id(team_id)
            .await
            .map_err(|error| AppError::internal(format!("查询球队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("球队不存在".to_string()))?;

        if team.captain_id == Some(user_id) {
            return Ok(true);
        }

        let members = self
            .team_repository
            .list_members(team_id)
            .await
            .map_err(|error| AppError::internal(format!("查询球队成员失败: {error}")))?;

        Ok(members.into_iter().any(|member| {
            member.status == 1
                && member.user_id == user_id
                && matches!(member.role.as_str(), "captain" | "leader")
        }))
    }
}
