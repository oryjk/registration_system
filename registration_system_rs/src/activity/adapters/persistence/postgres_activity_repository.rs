use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
    ActivityTeamCheckInConfig, DomainError, RegistrationListPage, UpdateActivityFields,
};
use crate::activity::ports::{ActivityCommandRepository, ActivityQueryRepository};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::PgPool;

#[derive(Clone)]
pub struct PostgresActivityRepository {
    pub(super) pool: PgPool,
}

impl PostgresActivityRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ActivityQueryRepository for PostgresActivityRepository {
    async fn list_page(
        &self,
        status_filter: Option<i8>,
        registration_scope: Option<&str>,
        team_id: Option<i64>,
        holding_after: Option<NaiveDateTime>,
        page: u32,
        page_size: u32,
    ) -> Result<ActivityListPage, DomainError> {
        self.list_page_query(
            status_filter,
            registration_scope,
            team_id,
            holding_after,
            page,
            page_size,
        )
            .await
    }

    async fn find_by_id(&self, activity_id: &str) -> Result<Option<Activity>, DomainError> {
        self.find_by_id_query(activity_id).await
    }

    async fn find_derived_by_source_and_team(
        &self,
        source_activity_id: &str,
        team_id: i64,
    ) -> Result<Option<Activity>, DomainError> {
        self.find_derived_by_source_and_team_query(source_activity_id, team_id)
            .await
    }

    async fn find_ongoing_activity(&self) -> Result<Option<Activity>, DomainError> {
        self.find_ongoing_activity_query().await
    }

    async fn list_registrations(
        &self,
        activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, DomainError> {
        self.list_registrations_query(activity_id).await
    }

    async fn count_capacity_registrations(&self, activity_id: &str) -> Result<i64, DomainError> {
        self.count_capacity_registrations_query(activity_id).await
    }

    async fn list_registrations_with_info_page(
        &self,
        activity_id: &str,
        activity_holding_date: NaiveDateTime,
        stand_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<RegistrationListPage, DomainError> {
        self.list_registrations_with_info_page_query(
            activity_id,
            activity_holding_date,
            stand_filter,
            page,
            page_size,
        )
        .await
    }

    async fn list_team_checkin_configs(
        &self,
        activity_id: &str,
    ) -> Result<Vec<ActivityTeamCheckInConfig>, DomainError> {
        self.list_team_checkin_configs_query(activity_id).await
    }

    async fn find_team_checkin_config(
        &self,
        activity_id: &str,
        team_id: i64,
    ) -> Result<Option<ActivityTeamCheckInConfig>, DomainError> {
        self.find_team_checkin_config_query(activity_id, team_id)
            .await
    }

    async fn find_checkin_record(
        &self,
        activity_id: &str,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<ActivityCheckInRecord>, DomainError> {
        self.find_checkin_record_query(activity_id, team_id, user_id)
            .await
    }
}

#[async_trait]
impl ActivityCommandRepository for PostgresActivityRepository {
    async fn create(&self, activity: &Activity) -> Result<(), DomainError> {
        self.create_command(activity).await
    }

    async fn delete_many(&self, ids: &[String]) -> Result<(), DomainError> {
        self.delete_many_command(ids).await
    }

    async fn update_status(&self, activity_id: &str, status: i8) -> Result<(), DomainError> {
        self.update_status_command(activity_id, status).await
    }

    async fn update_activity(
        &self,
        activity_id: &str,
        fields: UpdateActivityFields<'_>,
    ) -> Result<(), DomainError> {
        self.update_activity_command(activity_id, fields).await
    }

    async fn upsert_registration(
        &self,
        activity_id: &str,
        user_id: i64,
        stand: i8,
        registration_count: i32,
    ) -> Result<(), DomainError> {
        self.upsert_registration_command(activity_id, user_id, stand, registration_count)
            .await
    }

    async fn delete_registration(
        &self,
        activity_id: &str,
        user_id: i64,
    ) -> Result<u64, DomainError> {
        self.delete_registration_command(activity_id, user_id).await
    }

    async fn backfill_team_member_registrations(
        &self,
        activity_id: &str,
    ) -> Result<u64, DomainError> {
        self.backfill_team_member_registrations_command(activity_id)
            .await
    }

    async fn upsert_team_checkin_config(
        &self,
        config: &ActivityTeamCheckInConfig,
    ) -> Result<(), DomainError> {
        self.upsert_team_checkin_config_command(config).await
    }

    async fn record_checkin(
        &self,
        record: &ActivityCheckInRecord,
    ) -> Result<ActivityCheckInRecord, DomainError> {
        self.record_checkin_command(record).await
    }
}
