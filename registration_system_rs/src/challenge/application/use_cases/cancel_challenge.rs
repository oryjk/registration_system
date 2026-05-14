use crate::challenge::application::notifier::ChallengeNotifier;
use crate::challenge::application::permission::ChallengeTeamAccessChecker;
use crate::challenge::domain::{Challenge, ChallengeStatus};
use crate::challenge::ports::{ChallengeCommandRepository, ChallengeQueryRepository};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct CancelChallengeUseCase {
    query_repository: Arc<dyn ChallengeQueryRepository>,
    command_repository: Arc<dyn ChallengeCommandRepository>,
    team_access_checker: ChallengeTeamAccessChecker,
    notifier: ChallengeNotifier,
}

impl CancelChallengeUseCase {
    pub fn new(
        query_repository: Arc<dyn ChallengeQueryRepository>,
        command_repository: Arc<dyn ChallengeCommandRepository>,
        team_access_checker: ChallengeTeamAccessChecker,
        notifier: ChallengeNotifier,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            team_access_checker,
            notifier,
        }
    }

    pub async fn execute(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
    ) -> Result<Challenge, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        let challenge = self
            .query_repository
            .find_by_id(challenge_id)
            .await
            .map_err(|error| AppError::internal(format!("查询约队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("约队不存在".to_string()))?;

        if !self
            .team_access_checker
            .is_team_manager(challenge.host_team_id, actor.id)
            .await?
        {
            return Err(AppError::Forbidden);
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
}
