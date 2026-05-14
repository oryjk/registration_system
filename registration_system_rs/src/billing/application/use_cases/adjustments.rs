use crate::billing::application::commands::{
    CalibrateBalanceCommand, PenaltyCommand, RechargeCommand,
};
use crate::billing::application::read_models::{CalibrationResult, PenaltyResult};
use crate::billing::domain::BalanceCalibrationRecord;
use crate::billing::ports::{BillingCommandRepository, BillingQueryRepository};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct BillingAdjustmentUseCase {
    command_repository: Arc<dyn BillingCommandRepository>,
    query_repository: Arc<dyn BillingQueryRepository>,
}

impl BillingAdjustmentUseCase {
    pub fn new(
        query_repository: Arc<dyn BillingQueryRepository>,
        command_repository: Arc<dyn BillingCommandRepository>,
    ) -> Self {
        Self {
            command_repository,
            query_repository,
        }
    }

    pub async fn recharge(
        &self,
        actor: &ActorContext,
        command: RechargeCommand,
    ) -> Result<i64, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != command.user_id {
            return Err(AppError::Forbidden);
        }
        self.command_repository
            .recharge(
                command.user_id,
                command.amount,
                &command.payment_method,
                command.transaction_no.as_deref(),
                command.description.as_deref(),
            )
            .await
            .map_err(|error| AppError::internal(format!("用户充值失败: {error}")))
    }

    pub async fn add_penalty(
        &self,
        actor: &ActorContext,
        command: PenaltyCommand,
    ) -> Result<PenaltyResult, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        let month_key = chrono::Local::now().format("%Y-%m").to_string();
        let (penalty_id, fund_transaction_id) = self
            .command_repository
            .add_penalty(
                command.user_id,
                &month_key,
                command.amount,
                &command.reason,
                Some(actor.id),
            )
            .await
            .map_err(|error| AppError::internal(format!("罚款失败: {error}")))?;
        Ok(PenaltyResult {
            penalty_id,
            fund_transaction_id,
        })
    }

    pub async fn calibrate_balance(
        &self,
        actor: &ActorContext,
        command: CalibrateBalanceCommand,
    ) -> Result<CalibrationResult, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        let (calibration_id, current_balance) = self
            .command_repository
            .calibrate_balance(
                command.user_id,
                command.balance,
                command.effective_time,
                &command.reason,
                Some(actor.id),
            )
            .await
            .map_err(|error| AppError::internal(format!("余额校准失败: {error}")))?;

        Ok(CalibrationResult {
            calibration_id,
            current_balance,
        })
    }

    pub async fn list_balance_calibrations(
        &self,
        actor: &ActorContext,
    ) -> Result<Vec<BalanceCalibrationRecord>, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        self.query_repository
            .list_balance_calibrations()
            .await
            .map_err(|error| AppError::internal(format!("查询余额校准记录失败: {error}")))
    }

    pub async fn calculate_monthly_penalties(
        &self,
        actor: &ActorContext,
        month_key: &str,
    ) -> Result<Vec<PenaltyResult>, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        let candidates = self
            .query_repository
            .calculate_monthly_penalty_candidates(month_key)
            .await
            .map_err(|error| AppError::internal(format!("计算月度罚款失败: {error}")))?;

        let mut results = Vec::with_capacity(candidates.len());
        for candidate in candidates {
            let (penalty_id, fund_transaction_id) = self
                .command_repository
                .add_penalty(
                    candidate.user_id,
                    month_key,
                    candidate.amount,
                    &candidate.reason,
                    Some(actor.id),
                )
                .await
                .map_err(|error| AppError::internal(format!("保存月度罚款失败: {error}")))?;
            results.push(PenaltyResult {
                penalty_id,
                fund_transaction_id,
            });
        }
        Ok(results)
    }
}
