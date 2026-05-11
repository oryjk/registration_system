use crate::billing::domain::{
    ActivityBillingSummary, ActivityOrder, ActivitySettlementSummary, BalanceCalibrationRecord,
    BillingFlowResult, DomainError, TransactionRecord, UserAccount,
};
use crate::billing::ports::BillingRepository;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use rust_decimal::Decimal;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct CreateActivityOrderCommand {
    pub activity_id: String,
    pub description: String,
    pub fee: Decimal,
    pub total: i32,
}

#[derive(Debug, Clone)]
pub struct RechargeCommand {
    pub user_id: i64,
    pub amount: Decimal,
    pub payment_method: String,
    pub transaction_no: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct GameExpenseCommand {
    pub activity_id: String,
    pub total_amount: Decimal,
    pub user_ids: Vec<i64>,
    pub description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PenaltyCommand {
    pub user_id: i64,
    pub amount: Decimal,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct CalibrateBalanceCommand {
    pub user_id: i64,
    pub balance: Decimal,
    pub effective_time: chrono::NaiveDateTime,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct GameExpenseResult {
    pub activity_id: String,
    pub total_amount: Decimal,
    pub aa_fee: Decimal,
    pub user_count: usize,
    pub billing_ids: Vec<i64>,
}

#[derive(Debug, Clone)]
pub struct PenaltyResult {
    pub penalty_id: i64,
    pub fund_transaction_id: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct CalibrationResult {
    pub calibration_id: i64,
    pub current_balance: Decimal,
}

#[derive(Debug, Clone)]
pub struct SettleActivityExpenseCommand {
    pub activity_id: String,
    pub total_amount: Decimal,
    pub description: Option<String>,
}

#[derive(Clone)]
pub struct BillingService {
    repository: Arc<dyn BillingRepository>,
}

fn map_billing_domain_error(context: &str, error: DomainError) -> AppError {
    match error {
        DomainError::Validation(message) => AppError::Validation(message),
        DomainError::Conflict(message) => AppError::Conflict(message),
        DomainError::Infrastructure(message) => AppError::internal(format!("{context}: {message}")),
    }
}

impl BillingService {
    pub fn new(repository: Arc<dyn BillingRepository>) -> Self {
        Self { repository }
    }

    pub async fn get_my_balance(
        &self,
        actor: &ActorContext,
    ) -> Result<Option<UserAccount>, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        self.repository
            .get_user_account(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询账户余额失败: {error}")))
    }

    pub async fn create_activity_order(
        &self,
        actor: &ActorContext,
        command: CreateActivityOrderCommand,
    ) -> Result<ActivityOrder, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }

        self.repository
            .create_activity_order(
                &command.activity_id,
                &command.description,
                command.fee,
                command.total,
            )
            .await
            .map_err(|error| AppError::internal(format!("创建活动订单失败: {error}")))
    }

    pub async fn list_my_billings(
        &self,
        actor: &ActorContext,
    ) -> Result<BillingFlowResult, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        self.repository
            .get_user_billing_flow(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询个人账单流水失败: {error}")))
    }

    pub async fn get_user_balance(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<Option<UserAccount>, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
            return Err(AppError::Forbidden);
        }
        self.repository
            .get_user_account(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户余额失败: {error}")))
    }

    pub async fn recharge(
        &self,
        actor: &ActorContext,
        command: RechargeCommand,
    ) -> Result<i64, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != command.user_id {
            return Err(AppError::Forbidden);
        }
        self.repository
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

    pub async fn add_game_expense(
        &self,
        actor: &ActorContext,
        command: GameExpenseCommand,
    ) -> Result<GameExpenseResult, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        if command.user_ids.is_empty() {
            return Err(AppError::Validation("扣费用户不能为空".to_string()));
        }

        let divisor = Decimal::from(command.user_ids.len() as i64);
        let aa_fee = (command.total_amount / divisor).round_dp(2);
        let billing_ids = self
            .repository
            .add_game_expenses(
                &command.activity_id,
                &command.user_ids,
                aa_fee,
                command.description.as_deref(),
            )
            .await
            .map_err(|error| AppError::internal(format!("比赛扣费失败: {error}")))?;

        Ok(GameExpenseResult {
            activity_id: command.activity_id,
            total_amount: command.total_amount,
            aa_fee,
            user_count: command.user_ids.len(),
            billing_ids,
        })
    }

    pub async fn get_activity_settlement_summary(
        &self,
        actor: &ActorContext,
        activity_id: &str,
    ) -> Result<ActivitySettlementSummary, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }

        self.repository
            .get_activity_settlement_summary(activity_id)
            .await
            .map_err(|error| map_billing_domain_error("查询活动结算信息失败", error))
    }

    pub async fn settle_activity_expense(
        &self,
        actor: &ActorContext,
        command: SettleActivityExpenseCommand,
    ) -> Result<ActivitySettlementSummary, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        if command.total_amount <= Decimal::ZERO {
            return Err(AppError::Validation("结算总金额必须大于 0".to_string()));
        }

        self.repository
            .settle_activity_expense(
                &command.activity_id,
                command.total_amount,
                command.description.as_deref(),
                Some(actor.id),
            )
            .await
            .map_err(|error| map_billing_domain_error("结算比赛费用失败", error))
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
            .repository
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
            .repository
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
        self.repository
            .list_balance_calibrations()
            .await
            .map_err(|error| AppError::internal(format!("查询余额校准记录失败: {error}")))
    }

    pub async fn list_transactions(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
        limit: i64,
    ) -> Result<Vec<TransactionRecord>, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
            return Err(AppError::Forbidden);
        }
        self.repository
            .list_transactions(target_user_id, limit)
            .await
            .map_err(|error| AppError::internal(format!("查询交易记录失败: {error}")))
    }

    pub async fn get_order_by_id(
        &self,
        activity_id: &str,
    ) -> Result<Option<ActivityOrder>, AppError> {
        self.repository
            .get_activity_order(activity_id)
            .await
            .map_err(|error| AppError::internal(format!("查询订单失败: {error}")))
    }

    pub async fn list_orders(&self) -> Result<Vec<ActivityOrder>, AppError> {
        self.repository
            .list_activity_orders()
            .await
            .map_err(|error| AppError::internal(format!("查询订单列表失败: {error}")))
    }

    pub fn auto_calculate_fee(&self, number: i32, total: Decimal) -> Result<Decimal, AppError> {
        if number <= 0 {
            return Err(AppError::Validation("人数必须大于 0".to_string()));
        }
        Ok((total / Decimal::from(number)).round_dp(2))
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
            .repository
            .calculate_monthly_penalty_candidates(month_key)
            .await
            .map_err(|error| AppError::internal(format!("计算月度罚款失败: {error}")))?;

        let mut results = Vec::with_capacity(candidates.len());
        for candidate in candidates {
            let (penalty_id, fund_transaction_id) = self
                .repository
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

    pub async fn get_activities_billing(
        &self,
        actor: &ActorContext,
    ) -> Result<Vec<ActivityBillingSummary>, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        self.repository
            .list_activities_billing()
            .await
            .map_err(|error| AppError::internal(format!("查询活动账单失败: {error}")))
    }

    pub async fn get_users_billing(
        &self,
        actor: &ActorContext,
    ) -> Result<Vec<UserAccount>, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        self.repository
            .list_users_billing()
            .await
            .map_err(|error| AppError::internal(format!("查询用户账单汇总失败: {error}")))
    }

    pub async fn get_user_billing_flow(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<BillingFlowResult, AppError> {
        if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
            return Err(AppError::Forbidden);
        }
        self.repository
            .get_user_billing_flow(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户账单流水失败: {error}")))
    }
}
