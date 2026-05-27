use async_trait::async_trait;
use registration_system_backend::shared::auth::{ActorContext, ActorKind, Claims};
use registration_system_backend::shared::error::AppError;
use registration_system_backend::shared::ports::TokenServicePort;
use registration_system_backend::team::domain::{
    ActivityTeamReview, DomainError as TeamDomainError, Team, TeamAdminInfo,
    TeamAttendanceRankingItem, TeamCreditTransaction, TeamMember, TeamMemberAttendanceRecord,
    TeamMemberWithInfo, UpdateTeamFields,
};
use registration_system_backend::team::ports::{
    ActivityReviewRecord, MembershipRechargeRecord, MyTeamSummary, TeamCommandRepository,
    TeamQueryRepository,
};
use registration_system_backend::user::application::{
    CreateRoleUserCommand, RoleUserKind, UserService,
};
use registration_system_backend::user::domain::{
    DomainError, PlayerAdminListQuery, PlayerListResult, PlayerTeamSummary, UpdateUserFields, User,
    UserActivityRecord, UserAttendanceRanking, UserAttendanceRecord,
};
use registration_system_backend::user::ports::{UserCommandRepository, UserQueryRepository};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

type UpdatedFieldRecord = (i64, Option<bool>, Option<i8>);

#[derive(Default)]
struct RecordingUserRepository {
    admin_scopes: Mutex<Vec<Option<i64>>>,
    search_calls: Mutex<Vec<(String, i64)>>,
    users: Mutex<Vec<User>>,
    touched_logins: Mutex<Vec<i64>>,
    updated_password_hashes: Mutex<Vec<(i64, String)>>,
    updated_fields: Mutex<Vec<UpdatedFieldRecord>>,
    deleted_user_ids: Mutex<Vec<i64>>,
}

#[async_trait]
impl UserQueryRepository for RecordingUserRepository {
    async fn find_by_open_id(&self, _open_id: &str) -> Result<Option<User>, DomainError> {
        Ok(None)
    }

    async fn find_by_username(&self, username: &str) -> Result<Option<User>, DomainError> {
        Ok(self
            .users
            .lock()
            .unwrap()
            .iter()
            .find(|user| user.username == username)
            .cloned())
    }

    async fn find_by_id(&self, user_id: i64) -> Result<Option<User>, DomainError> {
        Ok(self
            .users
            .lock()
            .unwrap()
            .iter()
            .find(|user| user.id == user_id)
            .cloned())
    }

    async fn list_active(&self) -> Result<Vec<User>, DomainError> {
        unimplemented!()
    }

    async fn search(&self, keyword: &str, limit: i64) -> Result<Vec<User>, DomainError> {
        self.search_calls
            .lock()
            .unwrap()
            .push((keyword.to_string(), limit));
        Ok(Vec::new())
    }

    async fn list_players_admin(
        &self,
        query: PlayerAdminListQuery<'_>,
    ) -> Result<PlayerListResult, DomainError> {
        self.admin_scopes.lock().unwrap().push(query.admin_scope);
        Ok(PlayerListResult {
            items: Vec::new(),
            total: 0,
        })
    }

    async fn find_player_teams(
        &self,
        _user_ids: &[i64],
    ) -> Result<Vec<(i64, PlayerTeamSummary)>, DomainError> {
        unimplemented!()
    }

    async fn find_activities(&self, _user_id: i64) -> Result<Vec<UserActivityRecord>, DomainError> {
        unimplemented!()
    }

    async fn find_attendance_records(
        &self,
        _user_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRecord>, DomainError> {
        unimplemented!()
    }

    async fn find_attendance_ranking(
        &self,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRanking>, DomainError> {
        unimplemented!()
    }

    async fn find_attendance_ranking_for_user(
        &self,
        _user_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Option<UserAttendanceRanking>, DomainError> {
        unimplemented!()
    }
}

#[async_trait]
impl UserCommandRepository for RecordingUserRepository {
    async fn create(&self, user: &User) -> Result<User, DomainError> {
        let mut stored = user.clone();
        stored.id = self.users.lock().unwrap().len() as i64 + 100;
        self.users.lock().unwrap().push(stored.clone());
        Ok(stored)
    }

    async fn touch_login(&self, user_id: i64) -> Result<(), DomainError> {
        self.touched_logins.lock().unwrap().push(user_id);
        Ok(())
    }

    async fn update_password_hash(
        &self,
        user_id: i64,
        password_hash: &str,
    ) -> Result<(), DomainError> {
        self.updated_password_hashes
            .lock()
            .unwrap()
            .push((user_id, password_hash.to_string()));
        if let Some(user) = self
            .users
            .lock()
            .unwrap()
            .iter_mut()
            .find(|user| user.id == user_id)
        {
            user.password_hash = Some(password_hash.to_string());
        }
        Ok(())
    }

    async fn update_profile(
        &self,
        _user_id: i64,
        _nickname: Option<&str>,
        _real_name: Option<&str>,
        _avatar_url: Option<&str>,
    ) -> Result<(), DomainError> {
        unimplemented!()
    }

    async fn update_fields(
        &self,
        user_id: i64,
        fields: UpdateUserFields<'_>,
    ) -> Result<(), DomainError> {
        self.updated_fields
            .lock()
            .unwrap()
            .push((user_id, fields.is_venue, fields.status));
        if let Some(user) = self
            .users
            .lock()
            .unwrap()
            .iter_mut()
            .find(|user| user.id == user_id)
        {
            if let Some(is_venue) = fields.is_venue {
                user.is_venue = if is_venue { 1 } else { 0 };
            }
            if let Some(status) = fields.status {
                user.status = status;
            }
            if let Some(phone_number) = fields.phone_number {
                user.phone_number = phone_number.to_string();
            }
            if let Some(real_name) = fields.real_name {
                user.real_name = real_name.to_string();
            }
            if let Some(nickname) = fields.nickname {
                user.nickname = nickname.to_string();
            }
        }
        Ok(())
    }

    async fn delete(&self, user_id: i64) -> Result<(), DomainError> {
        self.deleted_user_ids.lock().unwrap().push(user_id);
        self.users.lock().unwrap().retain(|user| user.id != user_id);
        Ok(())
    }
}

#[derive(Default)]
struct RecordingTeamRepository {
    teams: Mutex<HashMap<i64, Team>>,
    captain_members: Mutex<Vec<(i64, i64)>>,
}

#[async_trait]
impl TeamQueryRepository for RecordingTeamRepository {
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

    async fn list_my_team_summaries(
        &self,
        _user_id: i64,
    ) -> Result<Vec<MyTeamSummary>, TeamDomainError> {
        Ok(Vec::new())
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
        unimplemented!()
    }

    async fn list_teams_by_admin(&self, _admin_id: i64) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_credit_transactions(
        &self,
        _team_id: i64,
        _limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, TeamDomainError> {
        unimplemented!()
    }

    async fn find_activity_review(
        &self,
        _activity_id: &str,
        _reviewer_team_id: i64,
    ) -> Result<Option<ActivityTeamReview>, TeamDomainError> {
        unimplemented!()
    }
}

#[async_trait]
impl TeamCommandRepository for RecordingTeamRepository {
    async fn create(&self, _team: &Team) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }

    async fn update(
        &self,
        team_id: i64,
        fields: UpdateTeamFields<'_>,
    ) -> Result<(), TeamDomainError> {
        if let Some(captain_id) = fields.captain_id
            && let Some(team) = self.teams.lock().unwrap().get_mut(&team_id)
        {
            team.captain_id = captain_id;
        }
        Ok(())
    }

    async fn delete(&self, _team_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn set_captain_member(&self, team_id: i64, user_id: i64) -> Result<(), TeamDomainError> {
        self.captain_members
            .lock()
            .unwrap()
            .push((team_id, user_id));
        self.update(
            team_id,
            UpdateTeamFields {
                captain_id: Some(Some(user_id)),
                ..Default::default()
            },
        )
        .await
    }

    async fn add_member(
        &self,
        _team_id: i64,
        _user_id: i64,
        _role: &str,
        _jersey_number: Option<&str>,
        _is_member: bool,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn reactivate_member(
        &self,
        _team_id: i64,
        _user_id: i64,
        _role: &str,
        _jersey_number: Option<&str>,
        _is_member: bool,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn remove_member(&self, _team_id: i64, _user_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn batch_remove_members(
        &self,
        _team_id: i64,
        _user_ids: &[i64],
    ) -> Result<u64, TeamDomainError> {
        unimplemented!()
    }

    async fn update_member(
        &self,
        _team_id: i64,
        _user_id: i64,
        _role: Option<&str>,
        _jersey_number: Option<Option<&str>>,
        _is_member: Option<bool>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn batch_update_member_status(
        &self,
        _team_id: i64,
        _user_ids: &[i64],
        _status: i8,
    ) -> Result<u64, TeamDomainError> {
        unimplemented!()
    }

    async fn assign_admin(&self, _team_id: i64, _admin_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn unassign_admin(&self, _team_id: i64, _admin_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
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
        _team_id: i64,
        _admin_id: i64,
        _points: i32,
        _reason: &str,
        _score_before: i32,
        _score_after: i32,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }
}

struct FakeTokenService;

impl TokenServicePort for FakeTokenService {
    fn issue_token(&self, actor_kind: ActorKind, subject_id: i64) -> Result<String, AppError> {
        Ok(format!("{actor_kind:?}-{subject_id}"))
    }

    fn issue_admin_token(
        &self,
        _subject_id: i64,
        _is_super_admin: bool,
    ) -> Result<String, AppError> {
        unimplemented!()
    }

    fn decode_token(&self, _token: &str) -> Result<Claims, AppError> {
        unimplemented!()
    }
}

fn admin_actor(id: i64, is_super_admin: bool) -> ActorContext {
    ActorContext {
        id,
        actor_kind: ActorKind::Admin,
        is_super_admin,
    }
}

fn user_actor(id: i64) -> ActorContext {
    ActorContext {
        id,
        actor_kind: ActorKind::User,
        is_super_admin: false,
    }
}

fn sample_team(team_id: i64) -> Team {
    let now = chrono::Utc::now().naive_utc();
    Team {
        id: team_id,
        name: format!("球队{team_id}"),
        description: None,
        logo_url: None,
        captain_id: None,
        join_password_hash: None,
        status: 1,
        credit_score: 80,
        vip_until: None,
        created_at: now,
        updated_at: now,
    }
}

fn user_service(
    user_repository: Arc<RecordingUserRepository>,
    team_repository: Arc<RecordingTeamRepository>,
) -> UserService {
    UserService::new(
        user_repository.clone(),
        user_repository,
        team_repository.clone(),
        team_repository,
        Arc::new(FakeTokenService),
    )
}

#[tokio::test]
async fn non_super_admin_player_list_is_scoped_to_managed_teams() {
    let repository = Arc::new(RecordingUserRepository::default());
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(repository.clone(), team_repository);

    service
        .list_players(
            &admin_actor(42, false),
            PlayerAdminListQuery {
                page: 1,
                page_size: 20,
                admin_scope: None,
                ..Default::default()
            },
        )
        .await
        .expect("普通管理员查询球员列表应成功");

    assert_eq!(
        repository.admin_scopes.lock().unwrap().as_slice(),
        &[Some(42)]
    );
}

#[tokio::test]
async fn super_admin_player_list_remains_unscoped() {
    let repository = Arc::new(RecordingUserRepository::default());
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(repository.clone(), team_repository);

    service
        .list_players(
            &admin_actor(7, true),
            PlayerAdminListQuery {
                page: 1,
                page_size: 20,
                admin_scope: None,
                ..Default::default()
            },
        )
        .await
        .expect("超级管理员查询球员列表应成功");

    assert_eq!(repository.admin_scopes.lock().unwrap().as_slice(), &[None]);
}

#[tokio::test]
async fn search_users_delegates_for_authenticated_user() {
    let repository = Arc::new(RecordingUserRepository::default());
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(repository.clone(), team_repository);

    let users = service
        .search_users(&user_actor(8), "alice", 10)
        .await
        .expect("小程序用户搜索候选队员应成功");

    assert!(users.is_empty());
    assert_eq!(
        repository.search_calls.lock().unwrap().as_slice(),
        &[("alice".to_string(), 10)]
    );
}

#[tokio::test]
async fn non_super_admin_cannot_create_role_user() {
    let user_repository = Arc::new(RecordingUserRepository::default());
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(user_repository, team_repository);

    let error = service
        .create_role_user(
            &admin_actor(42, false),
            CreateRoleUserCommand {
                role: RoleUserKind::Venue,
                username: "venue-a".to_string(),
                password: "secret123".to_string(),
                real_name: "赛悦体育".to_string(),
                nickname: None,
                phone_number: None,
                team_id: None,
            },
        )
        .await
        .expect_err("普通管理员不能创建队长/场馆账号");

    assert!(matches!(error, AppError::Forbidden));
}

#[tokio::test]
async fn super_admin_creates_venue_user_with_password_hash() {
    let user_repository = Arc::new(RecordingUserRepository::default());
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(user_repository.clone(), team_repository);

    let user = service
        .create_role_user(
            &admin_actor(7, true),
            CreateRoleUserCommand {
                role: RoleUserKind::Venue,
                username: "venue-a".to_string(),
                password: "secret123".to_string(),
                real_name: "赛悦体育".to_string(),
                nickname: Some("赛悦".to_string()),
                phone_number: Some("13800138000".to_string()),
                team_id: None,
            },
        )
        .await
        .expect("超级管理员应能创建场馆用户");

    assert_eq!(user.username, "venue-a");
    assert_eq!(user.real_name, "赛悦体育");
    assert_eq!(user.nickname, "赛悦");
    assert_eq!(user.phone_number, "13800138000");
    assert_eq!(user.is_venue, 1);
    assert!(bcrypt::verify("secret123", user.password_hash.as_deref().unwrap()).unwrap());
}

#[tokio::test]
async fn super_admin_creates_captain_user_and_binds_team() {
    let user_repository = Arc::new(RecordingUserRepository::default());
    let team_repository = Arc::new(RecordingTeamRepository::default());
    team_repository
        .teams
        .lock()
        .unwrap()
        .insert(8, sample_team(8));
    let service = user_service(user_repository.clone(), team_repository.clone());

    let user = service
        .create_role_user(
            &admin_actor(7, true),
            CreateRoleUserCommand {
                role: RoleUserKind::Captain,
                username: "captain-a".to_string(),
                password: "secret123".to_string(),
                real_name: "张队长".to_string(),
                nickname: None,
                phone_number: None,
                team_id: Some(8),
            },
        )
        .await
        .expect("超级管理员应能创建队长用户并绑定球队");

    assert_eq!(user.is_venue, 0);
    assert_eq!(
        team_repository.captain_members.lock().unwrap().as_slice(),
        &[(8, user.id)]
    );
    assert_eq!(
        team_repository
            .teams
            .lock()
            .unwrap()
            .get(&8)
            .and_then(|team| team.captain_id),
        Some(user.id)
    );
}

#[tokio::test]
async fn super_admin_can_change_role_user_password() {
    let user_repository = Arc::new(RecordingUserRepository::default());
    let mut existing = User::new(
        "openid-existing".to_string(),
        None,
        Some("venue-a".to_string()),
        None,
        None,
    );
    existing.id = 12;
    existing.real_name = "赛悦体育".to_string();
    existing.is_venue = 1;
    existing.password_hash = Some(bcrypt::hash("old-secret", bcrypt::DEFAULT_COST).unwrap());
    user_repository.users.lock().unwrap().push(existing);
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(user_repository.clone(), team_repository);

    service
        .change_role_user_password(&admin_actor(7, true), 12, "new-secret123".to_string())
        .await
        .expect("超级管理员应能修改角色用户密码");

    let updates = user_repository.updated_password_hashes.lock().unwrap();
    assert_eq!(updates.len(), 1);
    assert_eq!(updates[0].0, 12);
    assert!(bcrypt::verify("new-secret123", &updates[0].1).unwrap());
}

#[tokio::test]
async fn role_user_can_login_with_account_password() {
    let user_repository = Arc::new(RecordingUserRepository::default());
    let mut existing = User::new(
        "openid-existing".to_string(),
        None,
        Some("venue-a".to_string()),
        None,
        None,
    );
    existing.id = 12;
    existing.real_name = "赛悦体育".to_string();
    existing.is_venue = 1;
    existing.password_hash = Some(bcrypt::hash("secret123", bcrypt::DEFAULT_COST).unwrap());
    user_repository.users.lock().unwrap().push(existing);
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(user_repository.clone(), team_repository);

    let result = service
        .login_with_password("venue-a", "secret123")
        .await
        .expect("角色用户应能通过账号密码登录");

    assert_eq!(result.user.id, 12);
    assert_eq!(result.access_token, "User-12");
    assert_eq!(
        user_repository.touched_logins.lock().unwrap().as_slice(),
        &[12]
    );
}

#[tokio::test]
async fn role_user_password_login_rejects_wrong_password() {
    let user_repository = Arc::new(RecordingUserRepository::default());
    let mut existing = User::new(
        "openid-existing".to_string(),
        None,
        Some("venue-a".to_string()),
        None,
        None,
    );
    existing.id = 12;
    existing.real_name = "赛悦体育".to_string();
    existing.is_venue = 1;
    existing.password_hash = Some(bcrypt::hash("secret123", bcrypt::DEFAULT_COST).unwrap());
    user_repository.users.lock().unwrap().push(existing);
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(user_repository, team_repository);

    let error = service
        .login_with_password("venue-a", "bad-secret")
        .await
        .expect_err("密码错误时应拒绝登录");

    assert!(matches!(error, AppError::Unauthorized));
}

#[tokio::test]
async fn super_admin_can_bind_existing_user_as_venue() {
    let user_repository = Arc::new(RecordingUserRepository::default());
    let mut existing = User::new("openid-existing".to_string(), None, None, Some("阿豪".to_string()), None);
    existing.id = 18;
    existing.real_name = "陈豪".to_string();
    user_repository.users.lock().unwrap().push(existing);
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(user_repository.clone(), team_repository);

    let user = service
        .mark_user_as_venue(&admin_actor(7, true), 18)
        .await
        .expect("超级管理员应能把已有用户设为场馆");

    assert_eq!(user.id, 18);
    assert_eq!(user.is_venue, 1);
    assert_eq!(
        user_repository.updated_fields.lock().unwrap().as_slice(),
        &[(18, Some(true), None)]
    );
}

#[tokio::test]
async fn venue_identity_removal_keeps_existing_mini_user() {
    let user_repository = Arc::new(RecordingUserRepository::default());
    let mut existing =
        User::new("openid-existing".to_string(), None, None, Some("球场老王".to_string()), None);
    existing.id = 28;
    existing.real_name = "王场长".to_string();
    existing.is_venue = 1;
    user_repository.users.lock().unwrap().push(existing);
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(user_repository.clone(), team_repository);

    let user = service
        .remove_venue(&admin_actor(7, true), 28)
        .await
        .expect("已有小程序用户移除场馆身份应成功");

    let user = user.expect("已有小程序用户移除场馆身份后应保留用户记录");
    assert_eq!(user.id, 28);
    assert_eq!(user.is_venue, 0);
    assert!(user_repository.deleted_user_ids.lock().unwrap().is_empty());
}

#[tokio::test]
async fn deleting_standalone_venue_account_removes_user_record() {
    let user_repository = Arc::new(RecordingUserRepository::default());
    let mut existing = User::new(
        "admin_role_user_xxx".to_string(),
        None,
        Some("venue-a".to_string()),
        Some("赛悦".to_string()),
        None,
    );
    existing.id = 35;
    existing.real_name = "赛悦体育".to_string();
    existing.is_venue = 1;
    existing.password_hash = Some(bcrypt::hash("secret123", bcrypt::DEFAULT_COST).unwrap());
    user_repository.users.lock().unwrap().push(existing);
    let team_repository = Arc::new(RecordingTeamRepository::default());
    let service = user_service(user_repository.clone(), team_repository);

    let result = service
        .remove_venue(&admin_actor(7, true), 35)
        .await
        .expect("独立场馆账号应允许直接删除");

    assert!(result.is_none());
    assert_eq!(user_repository.deleted_user_ids.lock().unwrap().as_slice(), &[35]);
    assert!(user_repository
        .users
        .lock()
        .unwrap()
        .iter()
        .all(|user| user.id != 35));
}
