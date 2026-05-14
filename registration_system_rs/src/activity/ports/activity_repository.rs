use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
    ActivityTeamCheckInConfig, DomainError, RegistrationListPage, UpdateActivityFields,
};
use async_trait::async_trait;
use chrono::NaiveDateTime;

#[async_trait]
pub trait ActivityQueryRepository: Send + Sync {
    async fn list_page(
        &self,
        status_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<ActivityListPage, DomainError>;
    async fn find_by_id(&self, activity_id: &str) -> Result<Option<Activity>, DomainError>;
    async fn find_derived_by_source_and_team(
        &self,
        source_activity_id: &str,
        team_id: i64,
    ) -> Result<Option<Activity>, DomainError>;
    async fn find_ongoing_activity(&self) -> Result<Option<Activity>, DomainError>;
    async fn list_registrations(
        &self,
        activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, DomainError>;
    async fn count_capacity_registrations(&self, activity_id: &str) -> Result<i64, DomainError>;
    /// 含球员信息的报名列表（管理后台，分页 + 可选按 stand 筛选）
    async fn list_registrations_with_info_page(
        &self,
        activity_id: &str,
        activity_holding_date: NaiveDateTime,
        stand_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<RegistrationListPage, DomainError>;
    async fn list_team_checkin_configs(
        &self,
        activity_id: &str,
    ) -> Result<Vec<ActivityTeamCheckInConfig>, DomainError>;
    async fn find_team_checkin_config(
        &self,
        activity_id: &str,
        team_id: i64,
    ) -> Result<Option<ActivityTeamCheckInConfig>, DomainError>;
    async fn find_checkin_record(
        &self,
        activity_id: &str,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<ActivityCheckInRecord>, DomainError>;
}

#[async_trait]
pub trait ActivityCommandRepository: Send + Sync {
    async fn create(&self, activity: &Activity) -> Result<(), DomainError>;
    async fn delete_many(&self, ids: &[String]) -> Result<(), DomainError>;
    async fn update_status(&self, activity_id: &str, status: i8) -> Result<(), DomainError>;
    async fn update_activity(
        &self,
        activity_id: &str,
        fields: UpdateActivityFields<'_>,
    ) -> Result<(), DomainError>;
    async fn upsert_registration(
        &self,
        activity_id: &str,
        user_id: i64,
        stand: i8,
        registration_count: i32,
    ) -> Result<(), DomainError>;
    async fn delete_registration(
        &self,
        activity_id: &str,
        user_id: i64,
    ) -> Result<u64, DomainError>;
    async fn backfill_team_member_registrations(
        &self,
        activity_id: &str,
    ) -> Result<u64, DomainError>;
    async fn upsert_team_checkin_config(
        &self,
        config: &ActivityTeamCheckInConfig,
    ) -> Result<(), DomainError>;
    async fn record_checkin(
        &self,
        record: &ActivityCheckInRecord,
    ) -> Result<ActivityCheckInRecord, DomainError>;
}
