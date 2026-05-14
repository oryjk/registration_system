use async_trait::async_trait;
use registration_system_backend::billing::application::{
    BillingService, SettleActivityExpenseCommand,
};
use registration_system_backend::billing::domain::{
    ActivityBillingSummary, ActivityFeeSnapshot, ActivitySettlementSummary,
    BalanceCalibrationRecord, BillingFlowResult, DomainError, PenaltyCandidate, SettlementMode,
    SettlementParticipantScope, TransactionRecord, UserAccount, UserBillingRecord,
};
use registration_system_backend::billing::ports::{
    ActivitySettlementAccess, BillingActivityAccessPort, BillingCommandRepository,
    BillingQueryRepository, SettlementRequest,
};
use registration_system_backend::shared::auth::{ActorContext, ActorKind};
use registration_system_backend::shared::error::AppError;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct FakeBillingRepository {
    settle_requests: Mutex<Vec<(String, Option<i64>)>>,
}

#[async_trait]
impl BillingQueryRepository for FakeBillingRepository {
    async fn get_user_account(&self, _user_id: i64) -> Result<Option<UserAccount>, DomainError> {
        unimplemented!()
    }

    async fn get_activity_fee_snapshot(
        &self,
        _activity_id: &str,
    ) -> Result<Option<ActivityFeeSnapshot>, DomainError> {
        unimplemented!()
    }

    async fn list_activity_fee_snapshots(&self) -> Result<Vec<ActivityFeeSnapshot>, DomainError> {
        unimplemented!()
    }

    async fn get_activity_settlement_summary(
        &self,
        activity_id: &str,
    ) -> Result<ActivitySettlementSummary, DomainError> {
        Ok(sample_summary(activity_id))
    }

    async fn list_user_billings(
        &self,
        _user_id: i64,
    ) -> Result<Vec<UserBillingRecord>, DomainError> {
        unimplemented!()
    }

    async fn list_balance_calibrations(
        &self,
    ) -> Result<Vec<BalanceCalibrationRecord>, DomainError> {
        unimplemented!()
    }

    async fn list_transactions(
        &self,
        _user_id: i64,
        _limit: i64,
    ) -> Result<Vec<TransactionRecord>, DomainError> {
        unimplemented!()
    }

    async fn list_activities_billing(&self) -> Result<Vec<ActivityBillingSummary>, DomainError> {
        unimplemented!()
    }

    async fn list_users_billing(&self) -> Result<Vec<UserAccount>, DomainError> {
        unimplemented!()
    }

    async fn get_user_billing_flow(&self, _user_id: i64) -> Result<BillingFlowResult, DomainError> {
        unimplemented!()
    }

    async fn calculate_monthly_penalty_candidates(
        &self,
        _month_key: &str,
    ) -> Result<Vec<PenaltyCandidate>, DomainError> {
        unimplemented!()
    }
}

#[async_trait]
impl BillingCommandRepository for FakeBillingRepository {
    async fn upsert_activity_fee_snapshot(
        &self,
        _activity_id: &str,
        _description: &str,
        _fee: Decimal,
        _total: i32,
    ) -> Result<ActivityFeeSnapshot, DomainError> {
        unimplemented!()
    }

    async fn settle_activity_expense(
        &self,
        _activity_id: &str,
        _total_amount: Decimal,
        _description: Option<&str>,
        _created_by_admin_id: Option<i64>,
    ) -> Result<ActivitySettlementSummary, DomainError> {
        unimplemented!()
    }

    async fn settle_activity_expense_with_charges(
        &self,
        request: SettlementRequest<'_>,
    ) -> Result<ActivitySettlementSummary, DomainError> {
        self.settle_requests
            .lock()
            .unwrap()
            .push((request.activity_id.to_string(), request.created_by_admin_id));
        Ok(sample_summary(request.activity_id))
    }

    async fn recharge(
        &self,
        _user_id: i64,
        _amount: Decimal,
        _payment_method: &str,
        _transaction_no: Option<&str>,
        _description: Option<&str>,
    ) -> Result<i64, DomainError> {
        unimplemented!()
    }

    async fn add_activity_expenses(
        &self,
        _activity_id: &str,
        _user_ids: &[i64],
        _fee: Decimal,
        _description: Option<&str>,
    ) -> Result<Vec<i64>, DomainError> {
        unimplemented!()
    }

    async fn add_penalty(
        &self,
        _user_id: i64,
        _month_key: &str,
        _amount: Decimal,
        _reason: &str,
        _created_by: Option<i64>,
    ) -> Result<(i64, Option<i64>), DomainError> {
        unimplemented!()
    }

    async fn calibrate_balance(
        &self,
        _user_id: i64,
        _target_balance: Decimal,
        _effective_time: chrono::NaiveDateTime,
        _reason: &str,
        _created_by: Option<i64>,
    ) -> Result<(i64, Decimal), DomainError> {
        unimplemented!()
    }
}

#[derive(Default)]
struct FakeBillingActivityAccess {
    activities: Mutex<HashMap<String, ActivitySettlementAccess>>,
    roles: Mutex<HashMap<(i64, i64), String>>,
}

#[async_trait]
impl BillingActivityAccessPort for FakeBillingActivityAccess {
    async fn find_activity_settlement_access(
        &self,
        activity_id: &str,
    ) -> Result<Option<ActivitySettlementAccess>, String> {
        Ok(self.activities.lock().unwrap().get(activity_id).cloned())
    }

    async fn find_active_member_role(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<String>, String> {
        Ok(self.roles.lock().unwrap().get(&(team_id, user_id)).cloned())
    }
}

fn sample_summary(activity_id: &str) -> ActivitySettlementSummary {
    ActivitySettlementSummary {
        activity_id: activity_id.to_string(),
        mode: None,
        participant_scope: None,
        description: None,
        total_amount: None,
        aa_fee: None,
        attending_user_count: 2,
        settled_user_count: 0,
        settled: false,
        settled_at: None,
        current_batch_no: None,
        history: vec![],
        items: vec![],
    }
}

fn user_actor(user_id: i64) -> ActorContext {
    ActorContext {
        id: user_id,
        actor_kind: ActorKind::User,
        is_super_admin: false,
    }
}

fn build_service_with_role(role: &str) -> (BillingService, Arc<FakeBillingRepository>) {
    let repository = Arc::new(FakeBillingRepository::default());
    let access = Arc::new(FakeBillingActivityAccess::default());
    access.activities.lock().unwrap().insert(
        "activity-1".to_string(),
        ActivitySettlementAccess {
            activity_id: "activity-1".to_string(),
            home_team_id: Some(1),
            away_team_id: Some(2),
        },
    );
    access
        .roles
        .lock()
        .unwrap()
        .insert((1, 7), role.to_string());

    (
        BillingService::new(repository.clone(), repository.clone(), access),
        repository,
    )
}

#[tokio::test]
async fn team_leader_can_query_and_settle_activity_expense() {
    let (service, repository) = build_service_with_role("leader");

    let summary = service
        .get_activity_settlement_summary(&user_actor(7), "activity-1")
        .await
        .expect("leader should query settlement summary");
    assert_eq!(summary.activity_id, "activity-1");

    service
        .settle_activity_expense(
            &user_actor(7),
            SettleActivityExpenseCommand {
                activity_id: "activity-1".to_string(),
                total_amount: Decimal::new(12000, 2),
                mode: SettlementMode::Aa,
                participant_scope: SettlementParticipantScope::RegisteredAttendees,
                items: vec![],
                description: Some("队长赛后 AA 扣费".to_string()),
            },
        )
        .await
        .expect("leader should settle activity expense");

    assert_eq!(
        repository.settle_requests.lock().unwrap().as_slice(),
        &[("activity-1".to_string(), None)]
    );
}

#[tokio::test]
async fn regular_member_cannot_settle_activity_expense() {
    let (service, _) = build_service_with_role("member");

    let error = service
        .settle_activity_expense(
            &user_actor(7),
            SettleActivityExpenseCommand {
                activity_id: "activity-1".to_string(),
                total_amount: Decimal::new(12000, 2),
                mode: SettlementMode::Aa,
                participant_scope: SettlementParticipantScope::RegisteredAttendees,
                items: vec![],
                description: None,
            },
        )
        .await
        .expect_err("regular member should not settle activity expense");

    assert!(matches!(error, AppError::Forbidden));
}
