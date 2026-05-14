use crate::challenge::domain::ChallengeDetail;
use crate::challenge::ports::ChallengeQueryRepository;
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct GetChallengeDetailUseCase {
    query_repository: Arc<dyn ChallengeQueryRepository>,
}

impl GetChallengeDetailUseCase {
    pub fn new(query_repository: Arc<dyn ChallengeQueryRepository>) -> Self {
        Self { query_repository }
    }

    pub async fn execute(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
    ) -> Result<Option<ChallengeDetail>, AppError> {
        self.query_repository
            .get_detail(challenge_id, Some(actor.id))
            .await
            .map_err(|error| AppError::internal(format!("查询约队详情失败: {error}")))
    }
}
