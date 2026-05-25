use crate::challenge::application::notifier::ChallengeNotifier;
use crate::challenge::ports::ChallengeCommandRepository;
use crate::shared::error::AppError;
use chrono::NaiveDateTime;
use std::sync::Arc;

#[derive(Clone)]
pub struct ProcessIndividualPaymentsUseCase {
    command_repository: Arc<dyn ChallengeCommandRepository>,
    notifier: ChallengeNotifier,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProcessIndividualPaymentsResult {
    pub cancelled_count: usize,
    pub notified_count: usize,
}

impl ProcessIndividualPaymentsUseCase {
    pub fn new(
        command_repository: Arc<dyn ChallengeCommandRepository>,
        notifier: ChallengeNotifier,
    ) -> Self {
        Self {
            command_repository,
            notifier,
        }
    }

    pub async fn execute(
        &self,
        now: NaiveDateTime,
    ) -> Result<ProcessIndividualPaymentsResult, AppError> {
        let expired = self
            .command_repository
            .cancel_expired_prepaid_acceptances(now)
            .await
            .map_err(|error| AppError::internal(format!("取消过期散人报名失败: {error}")))?;

        let unpaid = self
            .command_repository
            .mark_postpaid_unpaid_acceptances_notified(now)
            .await
            .map_err(|error| AppError::internal(format!("标记赛后未支付通知失败: {error}")))?;

        for item in &unpaid {
            self.notifier
                .postpaid_payment_due(item.user_id, &item.challenge_id, &item.title)
                .await?;
        }

        Ok(ProcessIndividualPaymentsResult {
            cancelled_count: expired.len(),
            notified_count: unpaid.len(),
        })
    }
}
