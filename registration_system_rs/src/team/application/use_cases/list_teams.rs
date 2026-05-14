use crate::team::application::error::TeamApplicationError;
use crate::team::application::principal::TeamPrincipal;
use crate::team::application::read_models::TeamSummary;
use crate::team::domain::Team;
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct ListTeamsUseCase {
    query_repository: Arc<dyn TeamQueryRepository>,
}

impl ListTeamsUseCase {
    pub fn new(query_repository: Arc<dyn TeamQueryRepository>) -> Self {
        Self { query_repository }
    }

    pub async fn admin_list_teams(
        &self,
        principal: &TeamPrincipal,
        active_only: bool,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        if !principal.is_admin() {
            return Err(TeamApplicationError::Forbidden);
        }

        let teams = if principal.is_super_admin {
            self.query_repository
                .list(active_only)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("查询球队列表失败: {error}"))
                })?
        } else {
            self.query_repository
                .list_teams_by_admin(principal.id)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("查询管理员球队列表失败: {error}"))
                })?
        };

        self.attach_member_counts(teams).await
    }

    pub async fn list_teams(
        &self,
        active_only: bool,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        let teams = self
            .query_repository
            .list(active_only)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询球队列表失败: {error}"))
            })?;

        self.attach_member_counts(teams).await
    }

    pub async fn search_teams(
        &self,
        keyword: &str,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        let teams = if keyword.trim().is_empty() {
            self.query_repository
                .list(true)
                .await
                .map_err(|error| TeamApplicationError::internal(format!("查询球队失败: {error}")))?
        } else {
            self.query_repository
                .search(keyword)
                .await
                .map_err(|error| TeamApplicationError::internal(format!("搜索球队失败: {error}")))?
        };

        self.attach_member_counts(teams).await
    }

    async fn attach_member_counts(
        &self,
        teams: Vec<Team>,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        let mut result = Vec::with_capacity(teams.len());
        for team in teams {
            let count = self
                .query_repository
                .list_members(team.id)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("查询球队成员失败: {error}"))
                })?;
            result.push(TeamSummary {
                team,
                member_count: count.len(),
            });
        }
        Ok(result)
    }
}
