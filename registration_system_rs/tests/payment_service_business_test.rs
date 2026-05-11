use async_trait::async_trait;
use chrono::Utc;
use registration_system_backend::payment::application::PaymentService;
use registration_system_backend::payment::domain::{
    DomainError, PaymentOrder, PaymentOrderStatus, PaymentOrderType, PaymentQueryResult,
    TeamMembershipPaymentOrder, WxMiniPaymentParams,
};
use registration_system_backend::payment::ports::{
    PaymentBillingPort, PaymentOrderRepository, TeamMembershipSettlement, WxPayGateway,
};
use registration_system_backend::shared::auth::{ActorContext, ActorKind};
use registration_system_backend::team::domain::{
    ActivityTeamReview, DEFAULT_TEAM_CREDIT_SCORE, DomainError as TeamDomainError, Team,
    TeamAdminInfo, TeamCreditTransaction, TeamMember, TeamMemberAttendanceRecord,
    TeamMemberWithInfo, UpdateTeamFields,
};
use registration_system_backend::team::ports::{
    ActivityReviewRecord, MembershipRechargeRecord, TeamRepository,
};
use registration_system_backend::user::domain::{
    DomainError as UserDomainError, PlayerAdminListQuery, PlayerListResult, PlayerTeamSummary,
    User, UserActivityRecord, UserAttendanceRanking, UserAttendanceRecord,
};
use registration_system_backend::user::ports::UserRepository;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

type MembershipRecord = (String, i64, i32, Decimal, i32, String);

#[derive(Default)]
struct FakePaymentOrderRepository {
    orders: Mutex<HashMap<String, PaymentOrder>>,
    team_membership_orders: Mutex<HashMap<String, TeamMembershipPaymentOrder>>,
}

impl FakePaymentOrderRepository {
    fn insert(&self, order: PaymentOrder) {
        self.orders
            .lock()
            .unwrap()
            .insert(order.order_no.clone(), order);
    }

    fn get(&self, order_no: &str) -> Option<PaymentOrder> {
        self.orders.lock().unwrap().get(order_no).cloned()
    }
}

#[async_trait]
impl PaymentOrderRepository for FakePaymentOrderRepository {
    async fn create(&self, order: &PaymentOrder) -> Result<i64, DomainError> {
        let mut orders = self.orders.lock().unwrap();
        if orders.contains_key(&order.order_no) {
            return Err(DomainError::DuplicateOrder);
        }
        orders.insert(order.order_no.clone(), order.clone());
        Ok(orders.len() as i64)
    }

    async fn find_by_order_no(&self, order_no: &str) -> Result<Option<PaymentOrder>, DomainError> {
        Ok(self.get(order_no))
    }

    async fn find_by_user_id(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<PaymentOrder>, DomainError> {
        let mut orders = self
            .orders
            .lock()
            .unwrap()
            .values()
            .filter(|order| order.user_id == user_id)
            .cloned()
            .collect::<Vec<_>>();
        orders.sort_by(|left, right| right.order_no.cmp(&left.order_no));
        orders.truncate(limit as usize);
        Ok(orders)
    }

    async fn update_status(
        &self,
        order_no: &str,
        status: PaymentOrderStatus,
    ) -> Result<(), DomainError> {
        let mut orders = self.orders.lock().unwrap();
        let order = orders
            .get_mut(order_no)
            .ok_or_else(|| DomainError::Infrastructure("订单不存在".to_string()))?;
        order.status = status;
        Ok(())
    }

    async fn update_payment_info(
        &self,
        order_no: &str,
        prepay_id: &str,
        transaction_id: Option<&str>,
    ) -> Result<(), DomainError> {
        let mut orders = self.orders.lock().unwrap();
        let order = orders
            .get_mut(order_no)
            .ok_or_else(|| DomainError::Infrastructure("订单不存在".to_string()))?;
        order.prepay_id = Some(prepay_id.to_string());
        order.transaction_id = transaction_id.map(str::to_string);
        Ok(())
    }

    async fn mark_as_paid(
        &self,
        order_no: &str,
        transaction_id: &str,
        paid_at: chrono::NaiveDateTime,
    ) -> Result<(), DomainError> {
        let mut orders = self.orders.lock().unwrap();
        let order = orders
            .get_mut(order_no)
            .ok_or_else(|| DomainError::Infrastructure("订单不存在".to_string()))?;
        order.status = PaymentOrderStatus::Paid;
        order.transaction_id = Some(transaction_id.to_string());
        order.paid_at = Some(paid_at);
        Ok(())
    }

    async fn create_team_membership_order(
        &self,
        order: &TeamMembershipPaymentOrder,
    ) -> Result<i64, DomainError> {
        let mut items = self.team_membership_orders.lock().unwrap();
        items.insert(order.order_no.clone(), order.clone());
        Ok(items.len() as i64)
    }

    async fn find_team_membership_order(
        &self,
        order_no: &str,
    ) -> Result<Option<TeamMembershipPaymentOrder>, DomainError> {
        Ok(self
            .team_membership_orders
            .lock()
            .unwrap()
            .get(order_no)
            .cloned())
    }
}

#[derive(Default)]
struct FakePaymentBillingPort {
    recharges: Mutex<Vec<(i64, Decimal, String)>>,
    memberships: Mutex<Vec<MembershipRecord>>,
}

#[async_trait]
impl PaymentBillingPort for FakePaymentBillingPort {
    async fn apply_recharge(
        &self,
        user_id: i64,
        amount: Decimal,
        transaction_id: &str,
        _description: &str,
    ) -> Result<(), DomainError> {
        self.recharges
            .lock()
            .unwrap()
            .push((user_id, amount, transaction_id.to_string()));
        Ok(())
    }

    async fn apply_team_membership_order(
        &self,
        settlement: TeamMembershipSettlement<'_>,
    ) -> Result<(), DomainError> {
        self.memberships.lock().unwrap().push((
            settlement.order_no.to_string(),
            settlement.user_id,
            settlement.months,
            settlement.amount,
            settlement.credit_delta,
            settlement.transaction_id.to_string(),
        ));
        let _ = settlement.team_id;
        Ok(())
    }
}

#[derive(Default)]
struct FakeTeamRepository {
    teams: Mutex<HashMap<String, Team>>,
}

#[derive(Default)]
struct FakeUserRepository {
    users: Mutex<HashMap<i64, User>>,
}

impl FakeUserRepository {
    fn with_user(user: User) -> Self {
        let mut users = HashMap::new();
        users.insert(user.id, user);
        Self {
            users: Mutex::new(users),
        }
    }
}

#[async_trait]
impl UserRepository for FakeUserRepository {
    async fn find_by_open_id(&self, _open_id: &str) -> Result<Option<User>, UserDomainError> {
        unimplemented!()
    }

    async fn find_by_id(&self, user_id: i64) -> Result<Option<User>, UserDomainError> {
        Ok(self.users.lock().unwrap().get(&user_id).cloned())
    }

    async fn list_active(&self) -> Result<Vec<User>, UserDomainError> {
        unimplemented!()
    }

    async fn search(&self, _keyword: &str, _limit: i64) -> Result<Vec<User>, UserDomainError> {
        unimplemented!()
    }

    async fn create(&self, _user: &User) -> Result<User, UserDomainError> {
        unimplemented!()
    }

    async fn touch_login(&self, _user_id: i64) -> Result<(), UserDomainError> {
        unimplemented!()
    }

    async fn update_profile(
        &self,
        _user_id: i64,
        _nickname: Option<&str>,
        _real_name: Option<&str>,
        _avatar_url: Option<&str>,
    ) -> Result<(), UserDomainError> {
        unimplemented!()
    }

    async fn update_fields(
        &self,
        _user_id: i64,
        _fields: registration_system_backend::user::domain::UpdateUserFields<'_>,
    ) -> Result<(), UserDomainError> {
        unimplemented!()
    }

    async fn delete(&self, _user_id: i64) -> Result<(), UserDomainError> {
        unimplemented!()
    }

    async fn list_players_admin(
        &self,
        _query: PlayerAdminListQuery<'_>,
    ) -> Result<PlayerListResult, UserDomainError> {
        unimplemented!()
    }

    async fn find_player_teams(
        &self,
        _user_ids: &[i64],
    ) -> Result<Vec<(i64, PlayerTeamSummary)>, UserDomainError> {
        unimplemented!()
    }

    async fn find_activities(
        &self,
        _user_id: i64,
    ) -> Result<Vec<UserActivityRecord>, UserDomainError> {
        unimplemented!()
    }

    async fn find_attendance_records(
        &self,
        _user_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRecord>, UserDomainError> {
        unimplemented!()
    }

    async fn find_attendance_ranking(
        &self,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRanking>, UserDomainError> {
        unimplemented!()
    }

    async fn find_attendance_ranking_for_user(
        &self,
        _user_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Option<UserAttendanceRanking>, UserDomainError> {
        unimplemented!()
    }
}

impl FakeTeamRepository {
    fn with_team(team: Team) -> Self {
        let mut teams = HashMap::new();
        teams.insert(team.id.clone(), team);
        Self {
            teams: Mutex::new(teams),
        }
    }
}

#[async_trait]
impl TeamRepository for FakeTeamRepository {
    async fn create(&self, _team: &Team) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn find_by_id(&self, team_id: &str) -> Result<Option<Team>, TeamDomainError> {
        Ok(self.teams.lock().unwrap().get(team_id).cloned())
    }

    async fn find_by_name(&self, _name: &str) -> Result<Option<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn list(&self, _active_only: bool) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn search(&self, _keyword: &str) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn update(
        &self,
        _team_id: &str,
        _fields: UpdateTeamFields<'_>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn delete(&self, _team_id: &str) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn add_member(
        &self,
        _team_id: &str,
        _user_id: i64,
        _role: &str,
        _jersey_number: Option<&str>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn reactivate_member(
        &self,
        _team_id: &str,
        _user_id: i64,
        _role: &str,
        _jersey_number: Option<&str>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn remove_member(&self, _team_id: &str, _user_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn batch_remove_members(
        &self,
        _team_id: &str,
        _user_ids: &[i64],
    ) -> Result<u64, TeamDomainError> {
        unimplemented!()
    }

    async fn update_member(
        &self,
        _team_id: &str,
        _user_id: i64,
        _role: Option<&str>,
        _jersey_number: Option<Option<&str>>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn batch_update_member_status(
        &self,
        _team_id: &str,
        _user_ids: &[i64],
        _status: i8,
    ) -> Result<u64, TeamDomainError> {
        unimplemented!()
    }

    async fn is_member(&self, _team_id: &str, _user_id: i64) -> Result<bool, TeamDomainError> {
        unimplemented!()
    }

    async fn get_member_status(
        &self,
        _team_id: &str,
        _user_id: i64,
    ) -> Result<Option<i8>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members(&self, _team_id: &str) -> Result<Vec<TeamMember>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members_for_management(
        &self,
        _team_id: &str,
    ) -> Result<Vec<TeamMember>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_member_attendance_records(
        &self,
        _team_id: &str,
        _user_id: i64,
    ) -> Result<Vec<TeamMemberAttendanceRecord>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_user_teams(&self, _user_id: i64) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members_with_info(
        &self,
        _team_id: &str,
    ) -> Result<Vec<TeamMemberWithInfo>, TeamDomainError> {
        unimplemented!()
    }

    async fn assign_admin(&self, _team_id: &str, _admin_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn unassign_admin(&self, _team_id: &str, _admin_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn list_team_admins_with_info(
        &self,
        _team_id: &str,
    ) -> Result<Vec<TeamAdminInfo>, TeamDomainError> {
        unimplemented!()
    }

    async fn is_admin_assigned(
        &self,
        _team_id: &str,
        _admin_id: i64,
    ) -> Result<bool, TeamDomainError> {
        Ok(false)
    }

    async fn list_teams_by_admin(&self, _admin_id: i64) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_credit_transactions(
        &self,
        _team_id: &str,
        _limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, TeamDomainError> {
        Ok(Vec::new())
    }

    async fn find_activity_review(
        &self,
        _activity_id: &str,
        _reviewer_team_id: &str,
    ) -> Result<Option<ActivityTeamReview>, TeamDomainError> {
        Ok(None)
    }

    async fn record_activity_review(
        &self,
        _record: ActivityReviewRecord<'_>,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }

    async fn record_membership_recharge(
        &self,
        _record: MembershipRechargeRecord<'_>,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }

    async fn record_credit_penalty(
        &self,
        _team_id: &str,
        _admin_id: i64,
        _points: i32,
        _reason: &str,
        _score_before: i32,
        _score_after: i32,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }
}

struct FakeWxPayGateway {
    created_orders: Mutex<Vec<(String, Decimal, String)>>,
    query_result: Mutex<PaymentQueryResult>,
}

impl FakeWxPayGateway {
    fn new(query_result: PaymentQueryResult) -> Self {
        Self {
            created_orders: Mutex::new(Vec::new()),
            query_result: Mutex::new(query_result),
        }
    }
}

#[async_trait]
impl WxPayGateway for FakeWxPayGateway {
    async fn create_mini_pay(
        &self,
        order_no: &str,
        _description: &str,
        amount: Decimal,
        openid: &str,
    ) -> Result<(String, WxMiniPaymentParams), DomainError> {
        self.created_orders.lock().unwrap().push((
            order_no.to_string(),
            amount,
            openid.to_string(),
        ));
        Ok((
            "prepay-001".to_string(),
            WxMiniPaymentParams {
                time_stamp: "1".to_string(),
                nonce_str: "nonce".to_string(),
                package: "prepay_id=prepay-001".to_string(),
                sign_type: "RSA".to_string(),
                pay_sign: "sign".to_string(),
            },
        ))
    }

    async fn query_order(&self, _order_no: &str) -> Result<PaymentQueryResult, DomainError> {
        Ok(self.query_result.lock().unwrap().clone())
    }
}

fn user_actor(id: i64) -> ActorContext {
    ActorContext {
        id,
        actor_kind: ActorKind::User,
        is_super_admin: false,
    }
}

fn sample_team(team_id: &str, captain_id: i64) -> Team {
    let now = Utc::now().naive_utc();
    Team {
        id: team_id.to_string(),
        name: "银河联队".to_string(),
        description: None,
        logo_url: None,
        captain_id: Some(captain_id),
        join_password_hash: None,
        status: 1,
        credit_score: DEFAULT_TEAM_CREDIT_SCORE,
        vip_until: None,
        created_at: now,
        updated_at: now,
    }
}

fn sample_user(user_id: i64, open_id: &str) -> User {
    let mut user = User::new(open_id.to_string(), None, None, None, None);
    user.id = user_id;
    user
}

#[tokio::test]
async fn create_recharge_order_persists_order_and_prepay_info() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    let billing_port = Arc::new(FakePaymentBillingPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: false,
        transaction_id: None,
        trade_state: Some("NOTPAY".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamRepository::with_team(sample_team("team-1", 42)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        42,
        "stored-openid-42",
    )));
    let service = PaymentService::new(
        repository.clone(),
        billing_port,
        gateway.clone(),
        team_repository,
        user_repository,
    );

    let result = service
        .create_recharge_order(&user_actor(42), Decimal::new(1250, 2), Some("mini-openid"))
        .await
        .unwrap();

    let stored = repository.get(&result.order_no).expect("订单应已持久化");
    assert_eq!(stored.user_id, 42);
    assert_eq!(stored.amount, Decimal::new(1250, 2));
    assert_eq!(stored.prepay_id.as_deref(), Some("prepay-001"));

    let created = gateway.created_orders.lock().unwrap();
    assert_eq!(created.len(), 1);
    assert_eq!(created[0].0, result.order_no);
    assert_eq!(created[0].1, Decimal::new(1250, 2));
    assert_eq!(created[0].2, "mini-openid");
}

#[tokio::test]
async fn create_recharge_order_uses_actor_openid_when_payload_openid_missing() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    let billing_port = Arc::new(FakePaymentBillingPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: false,
        transaction_id: None,
        trade_state: Some("NOTPAY".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamRepository::with_team(sample_team("team-1", 42)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        42,
        "stored-openid-42",
    )));
    let service = PaymentService::new(
        repository,
        billing_port,
        gateway.clone(),
        team_repository,
        user_repository,
    );

    service
        .create_recharge_order(&user_actor(42), Decimal::new(1250, 2), None)
        .await
        .unwrap();

    let created = gateway.created_orders.lock().unwrap();
    assert_eq!(created[0].2, "stored-openid-42");
}

#[tokio::test]
async fn sync_order_status_marks_order_paid_and_applies_recharge() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    repository.insert(PaymentOrder {
        id: Some(1),
        order_no: "order-001".to_string(),
        user_id: 7,
        amount: Decimal::new(880, 2),
        order_type: PaymentOrderType::Recharge,
        status: PaymentOrderStatus::Unpaid,
        prepay_id: Some("prepay-001".to_string()),
        transaction_id: None,
        description: Some("账户充值".to_string()),
        paid_at: None,
        cancelled_at: None,
        created_at: Some(Utc::now().naive_utc()),
        updated_at: Some(Utc::now().naive_utc()),
    });
    let billing_port = Arc::new(FakePaymentBillingPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: true,
        transaction_id: Some("wx-tx-001".to_string()),
        trade_state: Some("SUCCESS".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamRepository::with_team(sample_team("team-1", 7)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        7,
        "stored-openid-7",
    )));
    let service = PaymentService::new(
        repository.clone(),
        billing_port.clone(),
        gateway,
        team_repository,
        user_repository,
    );

    let result = service
        .sync_order_status(&user_actor(7), "order-001")
        .await
        .unwrap();

    assert!(result.paid);
    let stored = repository.get("order-001").expect("订单应存在");
    assert_eq!(stored.status, PaymentOrderStatus::Paid);
    assert_eq!(stored.transaction_id.as_deref(), Some("wx-tx-001"));

    let recharges = billing_port.recharges.lock().unwrap();
    assert_eq!(recharges.len(), 1);
    assert_eq!(recharges[0].0, 7);
    assert_eq!(recharges[0].1, Decimal::new(880, 2));
    assert_eq!(recharges[0].2, "wx-tx-001");
}

#[tokio::test]
async fn create_team_membership_order_persists_membership_metadata() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    let billing_port = Arc::new(FakePaymentBillingPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: false,
        transaction_id: None,
        trade_state: Some("NOTPAY".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamRepository::with_team(sample_team("team-88", 88)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        88,
        "stored-openid-88",
    )));
    let service = PaymentService::new(
        repository.clone(),
        billing_port,
        gateway,
        team_repository,
        user_repository,
    );

    let result = service
        .create_team_membership_order(
            &user_actor(88),
            registration_system_backend::payment::application::CreateTeamMembershipOrderCommand {
                team_id: "team-88".to_string(),
                months: 2,
                openid: Some("openid-88".to_string()),
                note: Some("修复信用".to_string()),
            },
        )
        .await
        .unwrap();

    let stored = repository
        .find_team_membership_order(&result.order_no)
        .await
        .unwrap()
        .expect("应保存会员订单元数据");
    assert_eq!(stored.team_id, "team-88");
    assert_eq!(stored.months, 2);
    assert_eq!(stored.credit_delta, 12);
    assert_eq!(stored.amount, Decimal::new(6000, 2));
}

#[tokio::test]
async fn create_team_membership_order_uses_actor_openid_when_payload_openid_missing() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    let billing_port = Arc::new(FakePaymentBillingPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: false,
        transaction_id: None,
        trade_state: Some("NOTPAY".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamRepository::with_team(sample_team("team-88", 88)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        88,
        "stored-openid-88",
    )));
    let service = PaymentService::new(
        repository,
        billing_port,
        gateway.clone(),
        team_repository,
        user_repository,
    );

    service
        .create_team_membership_order(
            &user_actor(88),
            registration_system_backend::payment::application::CreateTeamMembershipOrderCommand {
                team_id: "team-88".to_string(),
                months: 2,
                openid: None,
                note: Some("修复信用".to_string()),
            },
        )
        .await
        .unwrap();

    let created = gateway.created_orders.lock().unwrap();
    assert_eq!(created[0].2, "stored-openid-88");
}

#[tokio::test]
async fn sync_order_status_applies_team_membership_credit() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    repository.insert(PaymentOrder {
        id: Some(2),
        order_no: "membership-001".to_string(),
        user_id: 9,
        amount: Decimal::new(3000, 2),
        order_type: PaymentOrderType::TeamMembership,
        status: PaymentOrderStatus::Unpaid,
        prepay_id: Some("prepay-membership".to_string()),
        transaction_id: None,
        description: Some("球队会员".to_string()),
        paid_at: None,
        cancelled_at: None,
        created_at: Some(Utc::now().naive_utc()),
        updated_at: Some(Utc::now().naive_utc()),
    });
    repository
        .create_team_membership_order(&TeamMembershipPaymentOrder {
            order_no: "membership-001".to_string(),
            team_id: "team-9".to_string(),
            user_id: 9,
            months: 1,
            credit_delta: 6,
            amount: Decimal::new(3000, 2),
            note: Some("修复信用".to_string()),
            applied_at: None,
        })
        .await
        .unwrap();

    let billing_port = Arc::new(FakePaymentBillingPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: true,
        transaction_id: Some("wx-team-001".to_string()),
        trade_state: Some("SUCCESS".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamRepository::with_team(sample_team("team-9", 9)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        9,
        "stored-openid-9",
    )));
    let service = PaymentService::new(
        repository.clone(),
        billing_port.clone(),
        gateway,
        team_repository,
        user_repository,
    );

    let result = service
        .sync_order_status(&user_actor(9), "membership-001")
        .await
        .unwrap();

    assert!(result.paid);
    let memberships = billing_port.memberships.lock().unwrap();
    assert_eq!(memberships.len(), 1);
    assert_eq!(memberships[0].0, "membership-001");
    assert_eq!(memberships[0].1, 9);
    assert_eq!(memberships[0].2, 1);
    assert_eq!(memberships[0].3, Decimal::new(3000, 2));
    assert_eq!(memberships[0].4, 6);
    assert_eq!(memberships[0].5, "wx-team-001");
}
