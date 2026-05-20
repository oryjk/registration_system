use crate::challenge::application::notifier::ChallengeNotifier;
use crate::challenge::application::permission::ChallengeTeamAccessChecker;
use crate::challenge::domain::{Challenge, ChallengeStatus};
use crate::challenge::ports::{ChallengeCommandRepository, ChallengeQueryRepository};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::team::ports::TeamQueryRepository;
use crate::user::ports::UserQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct CancelChallengeUseCase {
    query_repository: Arc<dyn ChallengeQueryRepository>,
    command_repository: Arc<dyn ChallengeCommandRepository>,
    team_access_checker: ChallengeTeamAccessChecker,
    team_repository: Arc<dyn TeamQueryRepository>,
    user_repository: Arc<dyn UserQueryRepository>,
    notifier: ChallengeNotifier,
}

impl CancelChallengeUseCase {
    pub fn new(
        query_repository: Arc<dyn ChallengeQueryRepository>,
        command_repository: Arc<dyn ChallengeCommandRepository>,
        team_access_checker: ChallengeTeamAccessChecker,
        team_repository: Arc<dyn TeamQueryRepository>,
        user_repository: Arc<dyn UserQueryRepository>,
        notifier: ChallengeNotifier,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            team_access_checker,
            team_repository,
            user_repository,
            notifier,
        }
    }

    pub async fn execute(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
    ) -> Result<Challenge, AppError> {
        let challenge = self
            .query_repository
            .find_by_id(challenge_id)
            .await
            .map_err(|error| AppError::internal(format!("查询约队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("约队不存在".to_string()))?;

        match actor.actor_kind {
            ActorKind::User => self.ensure_user_can_cancel(actor, &challenge).await?,
            ActorKind::Admin => self.ensure_admin_can_cancel(actor, &challenge).await?,
        }
        if challenge.status != ChallengeStatus::Open {
            return Err(AppError::Conflict("当前约队不可取消".to_string()));
        }

        let challenge = self
            .command_repository
            .cancel(challenge_id, actor.id)
            .await
            .map_err(|error| AppError::internal(format!("取消约队失败: {error}")))?;

        self.notifier.challenge_cancelled(&challenge).await?;

        Ok(challenge)
    }

    async fn ensure_user_can_cancel(
        &self,
        actor: &ActorContext,
        challenge: &Challenge,
    ) -> Result<(), AppError> {
        if let Some(host_team_id) = challenge.host_team_id {
            if self
                .team_access_checker
                .is_team_manager(host_team_id, actor.id)
                .await?
            {
                Ok(())
            } else {
                Err(AppError::Forbidden)
            }
        } else {
            let user = self
                .user_repository
                .find_by_id(actor.id)
                .await
                .map_err(|error| AppError::internal(format!("查询用户身份失败: {error}")))?
                .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))?;

            if challenge.host_user_id == actor.id && user.is_venue == 1 {
                Ok(())
            } else {
                Err(AppError::Forbidden)
            }
        }
    }

    async fn ensure_admin_can_cancel(
        &self,
        actor: &ActorContext,
        challenge: &Challenge,
    ) -> Result<(), AppError> {
        if actor.is_super_admin {
            return Ok(());
        }

        let managed_team_ids = self
            .team_repository
            .list_teams_by_admin(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询管理员球队失败: {error}")))?
            .into_iter()
            .map(|team| team.id)
            .collect::<Vec<_>>();

        if challenge
            .host_team_id
            .is_some_and(|team_id| managed_team_ids.contains(&team_id))
            || challenge
                .guest_team_id
                .is_some_and(|team_id| managed_team_ids.contains(&team_id))
        {
            Ok(())
        } else {
            Err(AppError::Forbidden)
        }
    }
}
