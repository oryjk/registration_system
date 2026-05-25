use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::shared::ports::TokenServicePort;
use crate::team::ports::{TeamCommandRepository, TeamQueryRepository};
use crate::user::application::commands::{CreateRoleUserCommand, UpdateUserCommand};
use crate::user::application::read_models::UserLoginResult;
use crate::user::application::use_cases::{
    ManagePlayerUseCase, UserLoginUseCase, UserProfileUseCase, UserQueryUseCase,
};
use crate::user::domain::{
    PlayerAdminListQuery, PlayerListResult, PlayerWithTeams, User, UserActivityRecord,
    UserAttendanceRanking, UserAttendanceRecord,
};
use crate::user::ports::{UserCommandRepository, UserQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct UserService {
    login_use_case: UserLoginUseCase,
    profile_use_case: UserProfileUseCase,
    query_use_case: UserQueryUseCase,
    manage_player_use_case: ManagePlayerUseCase,
}

impl UserService {
    pub fn new(
        query_repository: Arc<dyn UserQueryRepository>,
        command_repository: Arc<dyn UserCommandRepository>,
        team_query_repository: Arc<dyn TeamQueryRepository>,
        team_command_repository: Arc<dyn TeamCommandRepository>,
        token_service: Arc<dyn TokenServicePort>,
    ) -> Self {
        Self {
            login_use_case: UserLoginUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
                token_service,
            ),
            profile_use_case: UserProfileUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
            ),
            query_use_case: UserQueryUseCase::new(query_repository.clone()),
            manage_player_use_case: ManagePlayerUseCase::new(
                query_repository,
                command_repository,
                team_query_repository,
                team_command_repository,
            ),
        }
    }

    pub async fn login(
        &self,
        open_id: &str,
        union_id: Option<String>,
        username: Option<String>,
        nickname: Option<String>,
        avatar_url: Option<String>,
    ) -> Result<UserLoginResult, AppError> {
        self.login_use_case
            .execute(open_id, union_id, username, nickname, avatar_url)
            .await
    }

    pub async fn login_with_password(
        &self,
        username: &str,
        password: &str,
    ) -> Result<UserLoginResult, AppError> {
        self.login_use_case
            .execute_with_password(username, password)
            .await
    }

    pub async fn get_current_user(&self, actor: &ActorContext) -> Result<User, AppError> {
        self.profile_use_case.get_current_user(actor).await
    }

    pub async fn list_users(&self) -> Result<Vec<User>, AppError> {
        self.query_use_case.list_users().await
    }

    pub async fn search_users(
        &self,
        actor: &ActorContext,
        keyword: &str,
        limit: i64,
    ) -> Result<Vec<User>, AppError> {
        self.query_use_case
            .search_users(actor, keyword, limit)
            .await
    }

    pub async fn update_profile(
        &self,
        actor: &ActorContext,
        nickname: Option<&str>,
        real_name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<User, AppError> {
        self.profile_use_case
            .update_profile(actor, nickname, real_name, avatar_url)
            .await
    }

    pub async fn update_user_by_target(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
        command: UpdateUserCommand<'_>,
    ) -> Result<User, AppError> {
        self.profile_use_case
            .update_user_by_target(actor, target_user_id, command)
            .await
    }

    pub async fn delete_user(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<(), AppError> {
        self.profile_use_case
            .delete_user(actor, target_user_id)
            .await
    }

    pub async fn get_user_info(&self, target_user_id: i64) -> Result<User, AppError> {
        self.profile_use_case.get_user_info(target_user_id).await
    }

    pub async fn get_user_activities(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<Vec<UserActivityRecord>, AppError> {
        self.query_use_case
            .get_user_activities(actor, target_user_id)
            .await
    }

    pub async fn get_user_attendance_records(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRecord>, AppError> {
        self.query_use_case
            .get_user_attendance_records(actor, target_user_id, start_date, end_date)
            .await
    }

    pub async fn get_user_attendance_ranking(
        &self,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRanking>, AppError> {
        self.query_use_case
            .get_user_attendance_ranking(start_date, end_date)
            .await
    }

    pub async fn get_user_attendance_ranking_for_user(
        &self,
        target_user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Option<UserAttendanceRanking>, AppError> {
        self.query_use_case
            .get_user_attendance_ranking_for_user(target_user_id, start_date, end_date)
            .await
    }

    pub async fn list_players(
        &self,
        actor: &ActorContext,
        query: PlayerAdminListQuery<'_>,
    ) -> Result<PlayerListResult, AppError> {
        self.manage_player_use_case.list_players(actor, query).await
    }

    pub async fn update_user_phone(
        &self,
        actor: &ActorContext,
        user_id: i64,
        phone: &str,
    ) -> Result<(), AppError> {
        self.profile_use_case
            .update_user_phone(actor, user_id, phone)
            .await
    }

    pub async fn bind_current_user_phone(
        &self,
        actor: &ActorContext,
        phone: &str,
    ) -> Result<User, AppError> {
        self.profile_use_case
            .bind_current_user_phone(actor, phone)
            .await
    }

    pub async fn admin_create_player(
        &self,
        actor: &ActorContext,
        real_name: String,
        nickname: Option<String>,
        phone_number: Option<String>,
        is_venue: Option<bool>,
    ) -> Result<User, AppError> {
        self.manage_player_use_case
            .admin_create_player(actor, real_name, nickname, phone_number, is_venue)
            .await
    }

    pub async fn create_role_user(
        &self,
        actor: &ActorContext,
        command: CreateRoleUserCommand,
    ) -> Result<User, AppError> {
        self.manage_player_use_case
            .create_role_user(actor, command)
            .await
    }

    pub async fn change_role_user_password(
        &self,
        actor: &ActorContext,
        user_id: i64,
        password: String,
    ) -> Result<User, AppError> {
        self.manage_player_use_case
            .change_role_user_password(actor, user_id, password)
            .await
    }

    pub async fn get_player_detail(
        &self,
        actor: &ActorContext,
        user_id: i64,
    ) -> Result<PlayerWithTeams, AppError> {
        self.manage_player_use_case
            .get_player_detail(actor, user_id)
            .await
    }

    pub async fn freeze_player(
        &self,
        actor: &ActorContext,
        user_id: i64,
        freeze_start: chrono::NaiveDateTime,
        freeze_end: Option<chrono::NaiveDateTime>,
    ) -> Result<User, AppError> {
        self.manage_player_use_case
            .freeze_player(actor, user_id, freeze_start, freeze_end)
            .await
    }

    pub async fn unfreeze_player(
        &self,
        actor: &ActorContext,
        user_id: i64,
    ) -> Result<User, AppError> {
        self.manage_player_use_case
            .unfreeze_player(actor, user_id)
            .await
    }
}
