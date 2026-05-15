use crate::challenge::domain::{Challenge, ChallengeKind, ChallengeStatus};
use crate::challenge::ports::{ChallengeCommandRepository, ChallengeQueryRepository};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct CancelIndividualAcceptanceUseCase {
    query_repository: Arc<dyn ChallengeQueryRepository>,
    command_repository: Arc<dyn ChallengeCommandRepository>,
}

impl CancelIndividualAcceptanceUseCase {
    pub fn new(
        query_repository: Arc<dyn ChallengeQueryRepository>,
        command_repository: Arc<dyn ChallengeCommandRepository>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
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

        if challenge.kind != ChallengeKind::Individual {
            return Err(AppError::Validation("只有散人约队支持取消个人报名".to_string()));
        }
        if challenge.status == ChallengeStatus::Cancelled {
            return Err(AppError::Conflict("已取消的散人约队不能取消报名".to_string()));
        }

        self.command_repository
            .cancel_individual_acceptance(challenge_id, actor.id)
            .await
            .map_err(|error| match error {
                crate::challenge::domain::DomainError::Conflict(message) => AppError::Conflict(message),
                crate::challenge::domain::DomainError::NotFound(message) => AppError::NotFound(message),
                crate::challenge::domain::DomainError::Validation(message) => AppError::Validation(message),
                other => AppError::internal(format!("取消散人报名失败: {other}")),
            })
    }
}
