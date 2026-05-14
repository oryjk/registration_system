use crate::team::application::error::TeamApplicationError;
use crate::team::application::principal::TeamPrincipal;
use crate::team::domain::Team;
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct GetUserTeamsUseCase {
    query_repository: Arc<dyn TeamQueryRepository>,
}

impl GetUserTeamsUseCase {
    pub fn new(query_repository: Arc<dyn TeamQueryRepository>) -> Self {
        Self { query_repository }
    }

    pub async fn list_my_teams(
        &self,
        principal: &TeamPrincipal,
    ) -> Result<Vec<Team>, TeamApplicationError> {
        if !principal.is_user() {
            return Err(TeamApplicationError::Forbidden);
        }

        self.list_user_teams_for_target(principal, principal.id)
            .await
    }

    pub async fn list_user_teams_for_target(
        &self,
        principal: &TeamPrincipal,
        target_user_id: i64,
    ) -> Result<Vec<Team>, TeamApplicationError> {
        if !principal.is_admin() && principal.id != target_user_id {
            return Err(TeamApplicationError::Forbidden);
        }

        self.query_repository
            .list_user_teams(target_user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询用户球队失败: {error}")))
    }
}
