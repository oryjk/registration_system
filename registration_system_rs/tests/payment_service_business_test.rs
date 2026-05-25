use async_trait::async_trait;
use chrono::Utc;
use registration_system_backend::payment::application::PaymentService;
use registration_system_backend::payment::domain::{
    DomainError, PaymentOrder, PaymentOrderStatus, PaymentOrderType, PaymentQueryResult,
    TeamMembershipPaymentOrder, WxMiniPaymentParams,
};
use registration_system_backend::payment::ports::{
    ActivityPaymentAcceptance, ActivityPaymentAccessPort, ActivityPaymentSettlement,
    PaymentOrderCommandRepository, PaymentOrderQueryRepository, PaymentSettlementPort,
    RechargePaymentSettlement, TeamMembershipPaymentSettlement, WxPayGateway,
};
use registration_system_backend::shared::auth::{ActorContext, ActorKind};
use registration_system_backend::team::domain::{
    ActivityTeamReview, DEFAULT_TEAM_CREDIT_SCORE, DomainError as TeamDomainError, Team,
    TeamAdminInfo, TeamAttendanceRankingItem, TeamCreditTransaction, TeamMember,
    TeamMemberAttendanceRecord, TeamMemberWithInfo,
};
use registration_system_backend::team::ports::TeamQueryRepository;
use registration_system_backend::user::domain::{
    DomainError as UserDomainError, PlayerAdminListQuery, PlayerListResult, PlayerTeamSummary,
    User, UserActivityRecord, UserAttendanceRanking, UserAttendanceRecord,
};
use registration_system_backend::user::ports::{UserCommandRepository, UserQueryRepository};
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
impl PaymentOrderQueryRepository for FakePaymentOrderRepository {
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

#[async_trait]
impl PaymentOrderCommandRepository for FakePaymentOrderRepository {
    async fn create(&self, order: &PaymentOrder) -> Result<i64, DomainError> {
        let mut orders = self.orders.lock().unwrap();
        if orders.contains_key(&order.order_no) {
            return Err(DomainError::DuplicateOrder);
        }
        orders.insert(order.order_no.clone(), order.clone());
        Ok(orders.len() as i64)
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
}

#[derive(Default)]
struct FakePaymentSettlementPort {
    recharges: Mutex<Vec<(String, i64, Decimal, String)>>,
    memberships: Mutex<Vec<MembershipRecord>>,
    activities: Mutex<Vec<(String, i64, String)>>,
}

#[derive(Default)]
struct FakeActivityPaymentAccessPort {
    acceptances: Mutex<HashMap<(String, i64), ActivityPaymentAcceptance>>,
    attached_orders: Mutex<Vec<(String, i64, String)>>,
}

#[async_trait]
impl ActivityPaymentAccessPort for FakeActivityPaymentAccessPort {
    async fn find_individual_acceptance(
        &self,
        challenge_id: &str,
        user_id: i64,
    ) -> Result<Option<ActivityPaymentAcceptance>, DomainError> {
        Ok(self
            .acceptances
            .lock()
            .unwrap()
            .get(&(challenge_id.to_string(), user_id))
            .cloned())
    }

    async fn attach_payment_order(
        &self,
        challenge_id: &str,
        user_id: i64,
        order_no: &str,
    ) -> Result<(), DomainError> {
        self.attached_orders.lock().unwrap().push((
            challenge_id.to_string(),
            user_id,
            order_no.to_string(),
        ));
        Ok(())
    }
}

#[async_trait]
impl PaymentSettlementPort for FakePaymentSettlementPort {
    async fn settle_recharge_payment(
        &self,
        settlement: RechargePaymentSettlement<'_>,
    ) -> Result<(), DomainError> {
        self.recharges.lock().unwrap().push((
            settlement.order_no.to_string(),
            settlement.user_id,
            settlement.amount,
            settlement.transaction_id.to_string(),
        ));
        Ok(())
    }

    async fn settle_team_membership_payment(
        &self,
        settlement: TeamMembershipPaymentSettlement<'_>,
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

    async fn settle_activity_payment(
        &self,
        settlement: ActivityPaymentSettlement<'_>,
    ) -> Result<(), DomainError> {
        self.activities.lock().unwrap().push((
            settlement.order_no.to_string(),
            settlement.user_id,
            settlement.transaction_id.to_string(),
        ));
        Ok(())
    }
}

#[derive(Default)]
struct FakeTeamStore {
    teams: Mutex<HashMap<i64, Team>>,
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
impl UserQueryRepository for FakeUserRepository {
    async fn find_by_open_id(&self, _open_id: &str) -> Result<Option<User>, UserDomainError> {
        unimplemented!()
    }

    async fn find_by_username(&self, _username: &str) -> Result<Option<User>, UserDomainError> {
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

#[async_trait]
impl UserCommandRepository for FakeUserRepository {
    async fn create(&self, _user: &User) -> Result<User, UserDomainError> {
        unimplemented!()
    }

    async fn touch_login(&self, _user_id: i64) -> Result<(), UserDomainError> {
        unimplemented!()
    }

    async fn update_password_hash(
        &self,
        _user_id: i64,
        _password_hash: &str,
    ) -> Result<(), UserDomainError> {
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
}

impl FakeTeamStore {
    fn with_team(team: Team) -> Self {
        let mut teams = HashMap::new();
        teams.insert(team.id, team);
        Self {
            teams: Mutex::new(teams),
        }
    }
}

#[async_trait]
impl TeamQueryRepository for FakeTeamStore {
    async fn find_by_id(&self, team_id: i64) -> Result<Option<Team>, TeamDomainError> {
        Ok(self.teams.lock().unwrap().get(&team_id).cloned())
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

    async fn is_member(&self, _team_id: i64, _user_id: i64) -> Result<bool, TeamDomainError> {
        unimplemented!()
    }

    async fn get_member_status(
        &self,
        _team_id: i64,
        _user_id: i64,
    ) -> Result<Option<i8>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members(&self, _team_id: i64) -> Result<Vec<TeamMember>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members_for_management(
        &self,
        _team_id: i64,
    ) -> Result<Vec<TeamMember>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_member_attendance_records(
        &self,
        _team_id: i64,
        _user_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<TeamMemberAttendanceRecord>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_team_attendance_ranking(
        &self,
        _team_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<TeamAttendanceRankingItem>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_user_teams(&self, _user_id: i64) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members_with_info(
        &self,
        _team_id: i64,
    ) -> Result<Vec<TeamMemberWithInfo>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_team_admins_with_info(
        &self,
        _team_id: i64,
    ) -> Result<Vec<TeamAdminInfo>, TeamDomainError> {
        unimplemented!()
    }

    async fn is_admin_assigned(
        &self,
        _team_id: i64,
        _admin_id: i64,
    ) -> Result<bool, TeamDomainError> {
        Ok(false)
    }

    async fn list_teams_by_admin(&self, _admin_id: i64) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_credit_transactions(
        &self,
        _team_id: i64,
        _limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, TeamDomainError> {
        Ok(Vec::new())
    }

    async fn find_activity_review(
        &self,
        _activity_id: &str,
        _reviewer_team_id: i64,
    ) -> Result<Option<ActivityTeamReview>, TeamDomainError> {
        Ok(None)
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

fn sample_team(team_id: i64, captain_id: i64) -> Team {
    let now = Utc::now().naive_utc();
    Team {
        id: team_id,
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
    let settlement_port = Arc::new(FakePaymentSettlementPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: false,
        transaction_id: None,
        trade_state: Some("NOTPAY".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamStore::with_team(sample_team(1, 42)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        42,
        "stored-openid-42",
    )));
    let service = PaymentService::new(
        repository.clone(),
        repository.clone(),
        settlement_port,
        Arc::new(FakeActivityPaymentAccessPort::default()),
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
    let settlement_port = Arc::new(FakePaymentSettlementPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: false,
        transaction_id: None,
        trade_state: Some("NOTPAY".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamStore::with_team(sample_team(1, 42)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        42,
        "stored-openid-42",
    )));
    let service = PaymentService::new(
        repository.clone(),
        repository,
        settlement_port,
        Arc::new(FakeActivityPaymentAccessPort::default()),
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
    let settlement_port = Arc::new(FakePaymentSettlementPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: true,
        transaction_id: Some("wx-tx-001".to_string()),
        trade_state: Some("SUCCESS".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamStore::with_team(sample_team(1, 7)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        7,
        "stored-openid-7",
    )));
    let service = PaymentService::new(
        repository.clone(),
        repository.clone(),
        settlement_port.clone(),
        Arc::new(FakeActivityPaymentAccessPort::default()),
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

    let recharges = settlement_port.recharges.lock().unwrap();
    assert_eq!(recharges.len(), 1);
    assert_eq!(recharges[0].0, "order-001");
    assert_eq!(recharges[0].1, 7);
    assert_eq!(recharges[0].2, Decimal::new(880, 2));
    assert_eq!(recharges[0].3, "wx-tx-001");
}

#[tokio::test]
async fn create_team_membership_order_persists_membership_metadata() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    let settlement_port = Arc::new(FakePaymentSettlementPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: false,
        transaction_id: None,
        trade_state: Some("NOTPAY".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamStore::with_team(sample_team(88, 88)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        88,
        "stored-openid-88",
    )));
    let service = PaymentService::new(
        repository.clone(),
        repository.clone(),
        settlement_port,
        Arc::new(FakeActivityPaymentAccessPort::default()),
        gateway,
        team_repository,
        user_repository,
    );

    let result = service
        .create_team_membership_order(
            &user_actor(88),
            registration_system_backend::payment::application::CreateTeamMembershipOrderCommand {
                team_id: 88,
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
    assert_eq!(stored.team_id, 88);
    assert_eq!(stored.months, 2);
    assert_eq!(stored.credit_delta, 12);
    assert_eq!(stored.amount, Decimal::new(6000, 2));
}

#[tokio::test]
async fn create_team_membership_order_uses_actor_openid_when_payload_openid_missing() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    let settlement_port = Arc::new(FakePaymentSettlementPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: false,
        transaction_id: None,
        trade_state: Some("NOTPAY".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamStore::with_team(sample_team(88, 88)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        88,
        "stored-openid-88",
    )));
    let service = PaymentService::new(
        repository.clone(),
        repository,
        settlement_port,
        Arc::new(FakeActivityPaymentAccessPort::default()),
        gateway.clone(),
        team_repository,
        user_repository,
    );

    service
        .create_team_membership_order(
            &user_actor(88),
            registration_system_backend::payment::application::CreateTeamMembershipOrderCommand {
                team_id: 88,
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
            team_id: 9,
            user_id: 9,
            months: 1,
            credit_delta: 6,
            amount: Decimal::new(3000, 2),
            note: Some("修复信用".to_string()),
            applied_at: None,
        })
        .await
        .unwrap();

    let settlement_port = Arc::new(FakePaymentSettlementPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: true,
        transaction_id: Some("wx-team-001".to_string()),
        trade_state: Some("SUCCESS".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamStore::with_team(sample_team(9, 9)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        9,
        "stored-openid-9",
    )));
    let service = PaymentService::new(
        repository.clone(),
        repository.clone(),
        settlement_port.clone(),
        Arc::new(FakeActivityPaymentAccessPort::default()),
        gateway,
        team_repository,
        user_repository,
    );

    let result = service
        .sync_order_status(&user_actor(9), "membership-001")
        .await
        .unwrap();

    assert!(result.paid);
    let memberships = settlement_port.memberships.lock().unwrap();
    assert_eq!(memberships.len(), 1);
    assert_eq!(memberships[0].0, "membership-001");
    assert_eq!(memberships[0].1, 9);
    assert_eq!(memberships[0].2, 1);
    assert_eq!(memberships[0].3, Decimal::new(3000, 2));
    assert_eq!(memberships[0].4, 6);
    assert_eq!(memberships[0].5, "wx-team-001");
}

#[tokio::test]
async fn sync_order_status_is_idempotent_for_already_paid_recharge_order() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    repository.insert(PaymentOrder {
        id: Some(3),
        order_no: "order-paid-001".to_string(),
        user_id: 11,
        amount: Decimal::new(990, 2),
        order_type: PaymentOrderType::Recharge,
        status: PaymentOrderStatus::Paid,
        prepay_id: Some("prepay-paid".to_string()),
        transaction_id: Some("wx-paid-001".to_string()),
        description: Some("账户充值".to_string()),
        paid_at: Some(Utc::now().naive_utc()),
        cancelled_at: None,
        created_at: Some(Utc::now().naive_utc()),
        updated_at: Some(Utc::now().naive_utc()),
    });

    let settlement_port = Arc::new(FakePaymentSettlementPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: true,
        transaction_id: Some("wx-paid-001".to_string()),
        trade_state: Some("SUCCESS".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamStore::with_team(sample_team(11, 11)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        11,
        "stored-openid-11",
    )));
    let service = PaymentService::new(
        repository.clone(),
        repository,
        settlement_port.clone(),
        Arc::new(FakeActivityPaymentAccessPort::default()),
        gateway,
        team_repository,
        user_repository,
    );

    service
        .sync_order_status(&user_actor(11), "order-paid-001")
        .await
        .unwrap();
    service
        .sync_order_status(&user_actor(11), "order-paid-001")
        .await
        .unwrap();

    let recharges = settlement_port.recharges.lock().unwrap();
    assert_eq!(recharges.len(), 2);
    assert_eq!(recharges[0].0, "order-paid-001");
    assert_eq!(recharges[1].0, "order-paid-001");
}

#[tokio::test]
async fn sync_order_status_applies_activity_payment_settlement() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    repository.insert(PaymentOrder {
        id: Some(4),
        order_no: "activity-001".to_string(),
        user_id: 12,
        amount: Decimal::new(2500, 2),
        order_type: PaymentOrderType::Activity,
        status: PaymentOrderStatus::Unpaid,
        prepay_id: Some("prepay-activity".to_string()),
        transaction_id: None,
        description: Some("散人报名：周三晚".to_string()),
        paid_at: None,
        cancelled_at: None,
        created_at: Some(Utc::now().naive_utc()),
        updated_at: Some(Utc::now().naive_utc()),
    });

    let settlement_port = Arc::new(FakePaymentSettlementPort::default());
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: true,
        transaction_id: Some("wx-activity-001".to_string()),
        trade_state: Some("SUCCESS".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamStore::with_team(sample_team(12, 12)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        12,
        "stored-openid-12",
    )));
    let service = PaymentService::new(
        repository.clone(),
        repository.clone(),
        settlement_port.clone(),
        Arc::new(FakeActivityPaymentAccessPort::default()),
        gateway,
        team_repository,
        user_repository,
    );

    let result = service
        .sync_order_status(&user_actor(12), "activity-001")
        .await
        .unwrap();

    assert!(result.paid);
    let activities = settlement_port.activities.lock().unwrap();
    assert_eq!(activities.len(), 1);
    assert_eq!(activities[0].0, "activity-001");
    assert_eq!(activities[0].1, 12);
    assert_eq!(activities[0].2, "wx-activity-001");
}

#[tokio::test]
async fn create_challenge_payment_order_persists_activity_order_and_links_acceptance() {
    let repository = Arc::new(FakePaymentOrderRepository::default());
    let settlement_port = Arc::new(FakePaymentSettlementPort::default());
    let activity_payment_access = Arc::new(FakeActivityPaymentAccessPort::default());
    activity_payment_access.acceptances.lock().unwrap().insert(
        ("challenge-001".to_string(), 12),
        ActivityPaymentAcceptance {
            challenge_id: "challenge-001".to_string(),
            user_id: 12,
            title: "周三散人局".to_string(),
            amount: Decimal::new(2500, 2),
            payment_status: "unpaid".to_string(),
            payment_deadline_at: None,
        },
    );
    let gateway = Arc::new(FakeWxPayGateway::new(PaymentQueryResult {
        paid: false,
        transaction_id: None,
        trade_state: Some("NOTPAY".to_string()),
    }));
    let team_repository = Arc::new(FakeTeamStore::with_team(sample_team(12, 12)));
    let user_repository = Arc::new(FakeUserRepository::with_user(sample_user(
        12,
        "stored-openid-12",
    )));
    let service = PaymentService::new(
        repository.clone(),
        repository.clone(),
        settlement_port,
        activity_payment_access.clone(),
        gateway.clone(),
        team_repository,
        user_repository,
    );

    let result = service
        .create_challenge_payment_order(
            &user_actor(12),
            registration_system_backend::payment::application::CreateChallengePaymentOrderCommand {
                challenge_id: "challenge-001".to_string(),
                openid: None,
            },
        )
        .await
        .unwrap();

    let stored = repository
        .get(&result.order_no)
        .expect("activity payment order should be stored");
    assert_eq!(stored.order_type, PaymentOrderType::Activity);
    assert_eq!(stored.amount, Decimal::new(2500, 2));
    assert_eq!(stored.description.as_deref(), Some("散人报名：周三散人局"));

    let attached_orders = activity_payment_access.attached_orders.lock().unwrap();
    assert_eq!(attached_orders.len(), 1);
    assert_eq!(attached_orders[0].0, "challenge-001");
    assert_eq!(attached_orders[0].1, 12);
    assert_eq!(attached_orders[0].2, result.order_no);

    let created = gateway.created_orders.lock().unwrap();
    assert_eq!(created.len(), 1);
    assert_eq!(created[0].1, Decimal::new(2500, 2));
    assert_eq!(created[0].2, "stored-openid-12");
}
