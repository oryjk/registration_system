use crate::billing::application::commands::UpsertActivityFeeSnapshotCommand;
use crate::billing::domain::ActivityFeeSnapshot;
use crate::billing::ports::{BillingCommandRepository, BillingQueryRepository};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct BillingActivityFeeSnapshotUseCase {
    command_repository: Arc<dyn BillingCommandRepository>,
    query_repository: Arc<dyn BillingQueryRepository>,
}

impl BillingActivityFeeSnapshotUseCase {
    pub fn new(
        query_repository: Arc<dyn BillingQueryRepository>,
        command_repository: Arc<dyn BillingCommandRepository>,
    ) -> Self {
        Self {
            command_repository,
            query_repository,
        }
    }

    pub async fn upsert_activity_fee_snapshot(
        &self,
        actor: &ActorContext,
        command: UpsertActivityFeeSnapshotCommand,
    ) -> Result<ActivityFeeSnapshot, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }

        self.command_repository
            .upsert_activity_fee_snapshot(
                &command.activity_id,
                &command.description,
                command.fee,
                command.total,
            )
            .await
            .map_err(|error| AppError::internal(format!("保存活动费用快照失败: {error}")))
    }

    pub async fn get_activity_fee_snapshot_by_activity_id(
        &self,
        activity_id: &str,
    ) -> Result<Option<ActivityFeeSnapshot>, AppError> {
        self.query_repository
            .get_activity_fee_snapshot(activity_id)
            .await
            .map_err(|error| AppError::internal(format!("查询活动费用快照失败: {error}")))
    }

    pub async fn list_activity_fee_snapshots(&self) -> Result<Vec<ActivityFeeSnapshot>, AppError> {
        self.query_repository
            .list_activity_fee_snapshots()
            .await
            .map_err(|error| AppError::internal(format!("查询活动费用快照列表失败: {error}")))
    }
}
