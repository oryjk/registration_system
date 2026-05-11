use async_trait::async_trait;
use registration_system_backend::shared::auth::{ActorContext, ActorKind, Claims};
use registration_system_backend::shared::error::AppError;
use registration_system_backend::shared::ports::TokenServicePort;
use registration_system_backend::user::application::UserService;
use registration_system_backend::user::domain::{
    DomainError, PlayerAdminListQuery, PlayerListResult, PlayerTeamSummary, UpdateUserFields, User,
    UserActivityRecord, UserAttendanceRanking, UserAttendanceRecord,
};
use registration_system_backend::user::ports::UserRepository;
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct RecordingUserRepository {
    admin_scopes: Mutex<Vec<Option<i64>>>,
    search_calls: Mutex<Vec<(String, i64)>>,
}

#[async_trait]
impl UserRepository for RecordingUserRepository {
    async fn find_by_open_id(&self, _open_id: &str) -> Result<Option<User>, DomainError> {
        unimplemented!()
    }

    async fn find_by_id(&self, _user_id: i64) -> Result<Option<User>, DomainError> {
        unimplemented!()
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

    async fn create(&self, _user: &User) -> Result<User, DomainError> {
        unimplemented!()
    }

    async fn touch_login(&self, _user_id: i64) -> Result<(), DomainError> {
        unimplemented!()
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
        _user_id: i64,
        _fields: UpdateUserFields<'_>,
    ) -> Result<(), DomainError> {
        unimplemented!()
    }

    async fn delete(&self, _user_id: i64) -> Result<(), DomainError> {
        unimplemented!()
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

struct FakeTokenService;

impl TokenServicePort for FakeTokenService {
    fn issue_token(&self, _actor_kind: ActorKind, _subject_id: i64) -> Result<String, AppError> {
        unimplemented!()
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

#[tokio::test]
async fn non_super_admin_player_list_is_scoped_to_managed_teams() {
    let repository = Arc::new(RecordingUserRepository::default());
    let service = UserService::new(repository.clone(), Arc::new(FakeTokenService));

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
    let service = UserService::new(repository.clone(), Arc::new(FakeTokenService));

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
    let service = UserService::new(repository.clone(), Arc::new(FakeTokenService));

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
