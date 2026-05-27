use super::commands::{
    CreateActivityCommand, SubmitActivityCheckInCommand, UpdateActivityCommand,
    UpdateMyStandCommand, UpdateTeamCheckInConfigCommand,
};
use super::error::ActivityApplicationError;
use super::principal::ActivityPrincipal;
use super::read_models::OngoingActivityInfo;
use super::use_cases::{
    ActivityCheckInUseCase, ActivityLocationUseCase, ManageActivityUseCase,
    ManageRegistrationUseCase, QueryActivityUseCase, TeamRegistrationUseCase,
};
use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
    ActivityTeamCheckInConfig, RegistrationListPage,
};
use crate::activity::ports::{
    ActivityCommandRepository, ActivityQueryRepository, ActivityTeamAccessPort,
    LocationSearchGateway, LocationSearchResult,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct ActivityService {
    manage_activity_use_case: ManageActivityUseCase,
    query_activity_use_case: QueryActivityUseCase,
    location_use_case: ActivityLocationUseCase,
    manage_registration_use_case: ManageRegistrationUseCase,
    team_registration_use_case: TeamRegistrationUseCase,
    checkin_use_case: ActivityCheckInUseCase,
}

impl ActivityService {
    pub fn new(
        query_repository: Arc<dyn ActivityQueryRepository>,
        command_repository: Arc<dyn ActivityCommandRepository>,
        location_search_gateway: Option<Arc<dyn LocationSearchGateway>>,
        team_access_port: Arc<dyn ActivityTeamAccessPort>,
    ) -> Self {
        let permission_checker =
            super::permission::ActivityPermissionChecker::new(team_access_port.clone());
        Self {
            manage_activity_use_case: ManageActivityUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
                permission_checker.clone(),
            ),
            query_activity_use_case: QueryActivityUseCase::new(query_repository.clone()),
            manage_registration_use_case: ManageRegistrationUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
            ),
            team_registration_use_case: TeamRegistrationUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
                team_access_port.clone(),
                permission_checker.clone(),
            ),
            checkin_use_case: ActivityCheckInUseCase::new(
                query_repository,
                command_repository,
                team_access_port,
                permission_checker,
            ),
            location_use_case: ActivityLocationUseCase::new(location_search_gateway.clone()),
        }
    }

    pub async fn create_activity(
        &self,
        actor: &ActivityPrincipal,
        command: CreateActivityCommand,
    ) -> Result<Activity, ActivityApplicationError> {
        self.manage_activity_use_case
            .create_activity(actor, command)
            .await
    }

    pub async fn list_activities(
        &self,
        status_filter: Option<i8>,
        registration_scope: Option<&str>,
        team_id: Option<i64>,
        holding_after: Option<chrono::NaiveDateTime>,
        page: u32,
        page_size: u32,
    ) -> Result<ActivityListPage, ActivityApplicationError> {
        self.query_activity_use_case
            .list_activities(
                status_filter,
                registration_scope,
                team_id,
                holding_after,
                page,
                page_size,
            )
            .await
    }

    pub async fn search_locations(
        &self,
        actor: &ActivityPrincipal,
        keyword: &str,
        limit: u8,
    ) -> Result<Vec<LocationSearchResult>, ActivityApplicationError> {
        self.location_use_case
            .search_locations(actor, keyword, limit)
            .await
    }

    pub async fn resolve_location(
        &self,
        actor: &ActivityPrincipal,
        latitude: f64,
        longitude: f64,
    ) -> Result<LocationSearchResult, ActivityApplicationError> {
        self.location_use_case
            .resolve_location(actor, latitude, longitude)
            .await
    }

    pub async fn get_activity(
        &self,
        activity_id: &str,
    ) -> Result<Activity, ActivityApplicationError> {
        self.query_activity_use_case.get_activity(activity_id).await
    }

    pub async fn update_status(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        status: i8,
    ) -> Result<(), ActivityApplicationError> {
        self.manage_activity_use_case
            .update_status(actor, activity_id, status)
            .await
    }

    pub async fn update_my_stand(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: UpdateMyStandCommand,
    ) -> Result<(), ActivityApplicationError> {
        self.manage_registration_use_case
            .update_my_stand(actor, activity_id, command)
            .await
    }

    pub async fn update_user_stand(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_id: i64,
        command: UpdateMyStandCommand,
    ) -> Result<(), ActivityApplicationError> {
        self.manage_registration_use_case
            .update_user_stand(actor, activity_id, user_id, command)
            .await
    }

    pub async fn list_activity_users(
        &self,
        activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, ActivityApplicationError> {
        self.query_activity_use_case
            .list_activity_users(activity_id)
            .await
    }

    pub async fn delete_activities(
        &self,
        actor: &ActivityPrincipal,
        ids: &[String],
    ) -> Result<(), ActivityApplicationError> {
        self.manage_activity_use_case
            .delete_activities(actor, ids)
            .await
    }

    pub async fn check_ongoing_activities(
        &self,
    ) -> Result<OngoingActivityInfo, ActivityApplicationError> {
        self.query_activity_use_case
            .check_ongoing_activities()
            .await
    }

    pub async fn delete_user_registration(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_id: i64,
    ) -> Result<u64, ActivityApplicationError> {
        self.manage_registration_use_case
            .delete_user_registration(actor, activity_id, user_id)
            .await
    }

    pub async fn update_activity(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: UpdateActivityCommand,
    ) -> Result<(), ActivityApplicationError> {
        self.manage_activity_use_case
            .update_activity(actor, activity_id, command)
            .await
    }

    /// 管理后台：含球员信息的报名列表（分页，可选按 stand 筛选）
    pub async fn list_registrations_with_info(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        stand_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<RegistrationListPage, ActivityApplicationError> {
        self.query_activity_use_case
            .list_registrations_with_info(actor, activity_id, stand_filter, page, page_size)
            .await
    }

    /// 管理员手动为球员报名
    pub async fn admin_register_user(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_id: i64,
        stand: i8,
        registration_count: i32,
    ) -> Result<(), ActivityApplicationError> {
        self.manage_registration_use_case
            .admin_register_user(actor, activity_id, user_id, stand, registration_count)
            .await
    }

    /// 管理员批量修改报名状态
    pub async fn batch_update_user_stand(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_ids: &[i64],
        stand: i8,
        registration_count: i32,
    ) -> Result<u64, ActivityApplicationError> {
        self.manage_registration_use_case
            .batch_update_user_stand(actor, activity_id, user_ids, stand, registration_count)
            .await
    }

    pub async fn update_team_registration(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        team_id: i64,
        registration_count: i32,
    ) -> Result<Activity, ActivityApplicationError> {
        self.team_registration_use_case
            .update_team_registration(actor, activity_id, team_id, registration_count)
            .await
    }

    pub async fn cancel_team_registration(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        team_id: i64,
    ) -> Result<(), ActivityApplicationError> {
        self.team_registration_use_case
            .cancel_team_registration(actor, activity_id, team_id)
            .await
    }

    pub async fn backfill_activity(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
    ) -> Result<u64, ActivityApplicationError> {
        self.manage_activity_use_case
            .backfill_activity(actor, activity_id)
            .await
    }

    pub async fn update_team_checkin_config(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: UpdateTeamCheckInConfigCommand,
    ) -> Result<ActivityTeamCheckInConfig, ActivityApplicationError> {
        self.checkin_use_case
            .update_team_checkin_config(actor, activity_id, command)
            .await
    }

    pub async fn submit_check_in(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: SubmitActivityCheckInCommand,
    ) -> Result<ActivityCheckInRecord, ActivityApplicationError> {
        self.checkin_use_case
            .submit_check_in(actor, activity_id, command)
            .await
    }
}

#[cfg(test)]
mod tests;
