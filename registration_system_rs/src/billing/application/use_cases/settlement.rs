use crate::billing::application::commands::{ActivityExpenseCommand, SettleActivityExpenseCommand};
use crate::billing::application::error::map_billing_domain_error;
use crate::billing::application::read_models::ActivityExpenseResult;
use crate::billing::domain::{ActivitySettlementSummary, SettlementMode};
use crate::billing::ports::{
    BillingActivityAccessPort, BillingCommandRepository, BillingQueryRepository, SettlementCharge,
    SettlementRequest,
};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use rust_decimal::Decimal;
use std::sync::Arc;

#[derive(Clone)]
pub struct BillingSettlementUseCase {
    command_repository: Arc<dyn BillingCommandRepository>,
    query_repository: Arc<dyn BillingQueryRepository>,
    activity_access_port: Arc<dyn BillingActivityAccessPort>,
}

impl BillingSettlementUseCase {
    pub fn new(
        query_repository: Arc<dyn BillingQueryRepository>,
        command_repository: Arc<dyn BillingCommandRepository>,
        activity_access_port: Arc<dyn BillingActivityAccessPort>,
    ) -> Self {
        Self {
            command_repository,
            query_repository,
            activity_access_port,
        }
    }

    pub async fn add_activity_expense(
        &self,
        actor: &ActorContext,
        command: ActivityExpenseCommand,
    ) -> Result<ActivityExpenseResult, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        if command.user_ids.is_empty() {
            return Err(AppError::Validation("扣费用户不能为空".to_string()));
        }

        let divisor = Decimal::from(command.user_ids.len() as i64);
        let aa_fee = (command.total_amount / divisor).round_dp(2);
        let billing_ids = self
            .command_repository
            .add_activity_expenses(
                &command.activity_id,
                &command.user_ids,
                aa_fee,
                command.description.as_deref(),
            )
            .await
            .map_err(|error| AppError::internal(format!("比赛扣费失败: {error}")))?;

        Ok(ActivityExpenseResult {
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
        self.ensure_can_manage_activity_settlement(actor, activity_id)
            .await?;

        self.query_repository
            .get_activity_settlement_summary(activity_id)
            .await
            .map_err(|error| map_billing_domain_error("查询活动结算信息失败", error))
    }

    pub async fn settle_activity_expense(
        &self,
        actor: &ActorContext,
        command: SettleActivityExpenseCommand,
    ) -> Result<ActivitySettlementSummary, AppError> {
        self.ensure_can_manage_activity_settlement(actor, &command.activity_id)
            .await?;
        if command.total_amount <= Decimal::ZERO {
            return Err(AppError::Validation("结算总金额必须大于 0".to_string()));
        }
        let charges = command
            .items
            .iter()
            .map(|item| SettlementCharge {
                user_id: item.user_id,
                amount: item.amount,
            })
            .collect::<Vec<_>>();

        if command.mode == SettlementMode::Manual && charges.is_empty() {
            return Err(AppError::Validation("手动扣费明细不能为空".to_string()));
        }

        self.command_repository
            .settle_activity_expense_with_charges(SettlementRequest {
                activity_id: &command.activity_id,
                mode: command.mode,
                participant_scope: command.participant_scope,
                total_amount: command.total_amount,
                charges: &charges,
                description: command.description.as_deref(),
                created_by_admin_id: (actor.actor_kind == ActorKind::Admin).then_some(actor.id),
            })
            .await
            .map_err(|error| map_billing_domain_error("结算比赛费用失败", error))
    }

    async fn ensure_can_manage_activity_settlement(
        &self,
        actor: &ActorContext,
        activity_id: &str,
    ) -> Result<(), AppError> {
        if actor.actor_kind == ActorKind::Admin {
            return Ok(());
        }
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        let access = self
            .activity_access_port
            .find_activity_settlement_access(activity_id)
            .await
            .map_err(|error| AppError::internal(format!("查询活动结算权限失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("活动不存在".to_string()))?;

        let team_ids = [access.home_team_id, access.away_team_id];
        for team_id in team_ids.into_iter().flatten() {
            let role = self
                .activity_access_port
                .find_active_member_role(team_id, actor.id)
                .await
                .map_err(|error| AppError::internal(format!("查询球队角色失败: {error}")))?;
            if role
                .as_deref()
                .is_some_and(|role| matches!(role, "captain" | "leader"))
            {
                return Ok(());
            }
        }

        Err(AppError::Forbidden)
    }

    pub fn auto_calculate_fee(&self, number: i32, total: Decimal) -> Result<Decimal, AppError> {
        if number <= 0 {
            return Err(AppError::Validation("人数必须大于 0".to_string()));
        }
        Ok((total / Decimal::from(number)).round_dp(2))
    }
}
