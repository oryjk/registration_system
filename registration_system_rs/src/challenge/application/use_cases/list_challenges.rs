use crate::challenge::application::permission::ChallengeTeamAccessChecker;
use crate::challenge::application::queries::{
    AdminChallengeListQuery, PublicChallengeListQuery, TeamChallengeListRequest,
};
use crate::challenge::domain::{ChallengeKind, ChallengeStatus, ChallengeSummary};
use crate::challenge::ports::{
    AdminChallengeRepositoryQuery, ChallengeQueryRepository, TeamChallengeListQuery,
};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct ListChallengesUseCase {
    query_repository: Arc<dyn ChallengeQueryRepository>,
    team_repository: Arc<dyn TeamQueryRepository>,
    team_access_checker: ChallengeTeamAccessChecker,
}

impl ListChallengesUseCase {
    pub fn new(
        query_repository: Arc<dyn ChallengeQueryRepository>,
        team_repository: Arc<dyn TeamQueryRepository>,
        team_access_checker: ChallengeTeamAccessChecker,
    ) -> Self {
        Self {
            query_repository,
            team_repository,
            team_access_checker,
        }
    }

    pub async fn list_for_team(
        &self,
        actor: &ActorContext,
        query: TeamChallengeListRequest<'_>,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        let can_manage_team = self
            .team_access_checker
            .is_team_manager(query.team_id, actor.id)
            .await?;
        let mut items = self
            .query_repository
            .list_for_team(TeamChallengeListQuery {
                team_id: query.team_id,
                user_id: actor.id,
                keyword: query.keyword,
                status: query.status,
                kind: query.kind,
                include_closed: query.include_closed,
                limit: query.limit,
                sort: query.sort,
                starts_after: query.starts_after,
            })
            .await
            .map_err(|error| AppError::internal(format!("查询约队列表失败: {error}")))?;

        for item in &mut items {
            item.can_accept = match item.challenge.kind {
                ChallengeKind::Team => {
                    can_manage_team
                        && item.challenge.status == ChallengeStatus::Open
                        && item.challenge.host_team_id != Some(query.team_id)
                        && item.challenge.guest_team_id != Some(query.team_id)
                }
                ChallengeKind::Individual => {
                    item.challenge.status != ChallengeStatus::Cancelled
                        && item.accepted_count < item.challenge.max_signup_players()
                        && !item.current_user_joined
                }
            };
        }

        Ok(items)
    }

    pub async fn list_public(
        &self,
        query: PublicChallengeListQuery<'_>,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        self.query_repository
            .list_for_admin(AdminChallengeRepositoryQuery {
                accessible_team_ids: None,
                team_id: None,
                viewer_user_id: query.viewer_user_id,
                keyword: query.keyword,
                status: query.status,
                kind: query.kind,
                include_closed: query.include_closed,
                limit: query.limit,
                sort: query.sort,
                starts_after: query.starts_after,
            })
            .await
            .map_err(|error| AppError::internal(format!("查询公开约队列表失败: {error}")))
    }

    pub async fn list_for_admin(
        &self,
        actor: &ActorContext,
        query: AdminChallengeListQuery,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }

        let accessible_team_ids = if actor.is_super_admin {
            None
        } else {
            Some(
                self.team_repository
                    .list_teams_by_admin(actor.id)
                    .await
                    .map_err(|error| AppError::internal(format!("查询管理员球队失败: {error}")))?
                    .into_iter()
                    .map(|team| team.id)
                    .collect::<Vec<_>>(),
            )
        };

        self.query_repository
            .list_for_admin(AdminChallengeRepositoryQuery {
                accessible_team_ids: accessible_team_ids.as_deref(),
                team_id: query.team_id,
                viewer_user_id: None,
                keyword: query.keyword.as_deref(),
                status: query.status,
                kind: query.kind,
                include_closed: query.include_closed,
                limit: query.limit,
                sort: &query.sort,
                starts_after: query.starts_after,
            })
            .await
            .map_err(|error| AppError::internal(format!("查询后台约队列表失败: {error}")))
    }
}
