use async_trait::async_trait;
use chrono::{Duration, Local, NaiveDate};
use registration_system_backend::activity::application::{
    ActivityApplicationError, ActivityPrincipal, ActivityService, SubmitActivityCheckInCommand,
    UpdateTeamCheckInConfigCommand,
};
use registration_system_backend::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration, ActivityStatusCounts,
    ActivityTeamCheckInConfig, DomainError, RegistrationListPage, RegistrationStandCounts,
    UpdateActivityFields,
};
use registration_system_backend::activity::ports::{
    ActivityCommandRepository, ActivityQueryRepository, ActivityTeamAccessPort,
    LocationSearchGateway, LocationSearchResult,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct InMemoryActivityRepository {
    activity: Mutex<Option<Activity>>,
    configs: Mutex<HashMap<(String, i64), ActivityTeamCheckInConfig>>,
    checkins: Mutex<HashMap<(String, i64, i64), ActivityCheckInRecord>>,
}

#[async_trait]
impl ActivityQueryRepository for InMemoryActivityRepository {
    async fn list_page(
        &self,
        _status_filter: Option<i8>,
        _registration_scope: Option<&str>,
        _team_id: Option<i64>,
        _holding_after: Option<chrono::NaiveDateTime>,
        page: u32,
        page_size: u32,
    ) -> Result<ActivityListPage, DomainError> {
        Ok(ActivityListPage {
            items: vec![],
            total: 0,
            page,
            page_size,
            counts: ActivityStatusCounts {
                total: 0,
                registering: 0,
                ongoing: 0,
                ended: 0,
                cancelled: 0,
            },
        })
    }

    async fn find_by_id(&self, _activity_id: &str) -> Result<Option<Activity>, DomainError> {
        Ok(self.activity.lock().unwrap().clone())
    }

    async fn find_derived_by_source_and_team(
        &self,
        _source_activity_id: &str,
        _team_id: i64,
    ) -> Result<Option<Activity>, DomainError> {
        Ok(None)
    }

    async fn find_ongoing_activity(&self) -> Result<Option<Activity>, DomainError> {
        Ok(None)
    }

    async fn list_registrations(
        &self,
        _activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, DomainError> {
        Ok(vec![])
    }

    async fn count_capacity_registrations(&self, _activity_id: &str) -> Result<i64, DomainError> {
        Ok(0)
    }

    async fn list_registrations_with_info_page(
        &self,
        _activity_id: &str,
        _activity_holding_date: chrono::NaiveDateTime,
        _stand_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<RegistrationListPage, DomainError> {
        Ok(RegistrationListPage {
            items: vec![],
            total: 0,
            page,
            page_size,
            counts: RegistrationStandCounts {
                total: 0,
                unknown: 0,
                attending: 0,
                leave: 0,
                absent: 0,
            },
        })
    }

    async fn list_team_checkin_configs(
        &self,
        _activity_id: &str,
    ) -> Result<Vec<ActivityTeamCheckInConfig>, DomainError> {
        Ok(self.configs.lock().unwrap().values().cloned().collect())
    }

    async fn find_team_checkin_config(
        &self,
        activity_id: &str,
        team_id: i64,
    ) -> Result<Option<ActivityTeamCheckInConfig>, DomainError> {
        Ok(self
            .configs
            .lock()
            .unwrap()
            .get(&(activity_id.to_string(), team_id))
            .cloned())
    }

    async fn find_checkin_record(
        &self,
        activity_id: &str,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<ActivityCheckInRecord>, DomainError> {
        Ok(self
            .checkins
            .lock()
            .unwrap()
            .get(&(activity_id.to_string(), team_id, user_id))
            .cloned())
    }
}

#[async_trait]
impl ActivityCommandRepository for InMemoryActivityRepository {
    async fn create(&self, _activity: &Activity) -> Result<(), DomainError> {
        Ok(())
    }

    async fn delete_many(&self, _ids: &[String]) -> Result<(), DomainError> {
        Ok(())
    }

    async fn update_status(&self, _activity_id: &str, _status: i8) -> Result<(), DomainError> {
        Ok(())
    }

    async fn update_activity(
        &self,
        _activity_id: &str,
        _fields: UpdateActivityFields<'_>,
    ) -> Result<(), DomainError> {
        Ok(())
    }

    async fn upsert_registration(
        &self,
        _activity_id: &str,
        _user_id: i64,
        _stand: i8,
        _registration_count: i32,
    ) -> Result<(), DomainError> {
        Ok(())
    }

    async fn delete_registration(
        &self,
        _activity_id: &str,
        _user_id: i64,
    ) -> Result<u64, DomainError> {
        Ok(0)
    }

    async fn backfill_team_member_registrations(
        &self,
        _activity_id: &str,
    ) -> Result<u64, DomainError> {
        Ok(0)
    }

    async fn upsert_team_checkin_config(
        &self,
        config: &ActivityTeamCheckInConfig,
    ) -> Result<(), DomainError> {
        self.configs
            .lock()
            .unwrap()
            .insert((config.activity_id.clone(), config.team_id), config.clone());
        Ok(())
    }

    async fn record_checkin(
        &self,
        record: &ActivityCheckInRecord,
    ) -> Result<ActivityCheckInRecord, DomainError> {
        self.checkins.lock().unwrap().insert(
            (record.activity_id.clone(), record.team_id, record.user_id),
            record.clone(),
        );
        Ok(record.clone())
    }
}

#[derive(Default)]
struct InMemoryTeamAccessPort {
    roles: Mutex<HashMap<(i64, i64), String>>,
}

#[async_trait]
impl ActivityTeamAccessPort for InMemoryTeamAccessPort {
    async fn find_active_member_role(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<String>, String> {
        Ok(self.roles.lock().unwrap().get(&(team_id, user_id)).cloned())
    }
}

struct NoopLocationGateway;

#[async_trait]
impl LocationSearchGateway for NoopLocationGateway {
    async fn search_locations(
        &self,
        _keyword: &str,
        _limit: u8,
    ) -> Result<Vec<LocationSearchResult>, String> {
        Ok(vec![])
    }

    async fn resolve_location(
        &self,
        _latitude: f64,
        _longitude: f64,
    ) -> Result<LocationSearchResult, String> {
        Err("unused".to_string())
    }
}

fn sample_activity() -> Activity {
    let holding_date = NaiveDate::from_ymd_opt(2026, 4, 18)
        .unwrap()
        .and_hms_opt(20, 0, 0)
        .unwrap();

    Activity {
        id: "activity-checkin-1".to_string(),
        cover: None,
        start_time: holding_date - Duration::days(1),
        end_time: holding_date - Duration::hours(2),
        holding_date,
        location: "府河绿道足球场".to_string(),
        location_latitude: Some(30.671_821),
        location_longitude: Some(104.082_169),
        name: "周六友谊赛".to_string(),
        opposing: Some("北门联队".to_string()),
        status: 0,
        description: None,
        home_team_id: Some(1),
        away_team_id: Some(2),
        color: None,
        opposing_color: None,
        players_per_team: Some(11),
        match_kind: Some("external".to_string()),
        source_activity_id: None,
        team_registration_count: None,
        team_checkin_configs: vec![],
        created_at: holding_date - Duration::days(3),
        updated_at: holding_date - Duration::days(3),
    }
}

fn build_service(
    activity: Activity,
    roles: &[(i64, i64, &str)],
) -> (
    ActivityService,
    Arc<InMemoryActivityRepository>,
    Arc<InMemoryTeamAccessPort>,
) {
    let repository = Arc::new(InMemoryActivityRepository::default());
    *repository.activity.lock().unwrap() = Some(activity);

    let team_access = Arc::new(InMemoryTeamAccessPort::default());
    for (team_id, user_id, role) in roles {
        team_access
            .roles
            .lock()
            .unwrap()
            .insert((*team_id, *user_id), (*role).to_string());
    }

    (
        ActivityService::new(
            repository.clone(),
            repository.clone(),
            Some(Arc::new(NoopLocationGateway)),
            team_access.clone(),
        ),
        repository,
        team_access,
    )
}

#[tokio::test]
async fn leader_can_enable_checkin_for_participating_team() {
    let (service, repository, _) = build_service(sample_activity(), &[(1, 7, "leader")]);

    let config = service
        .update_team_checkin_config(
            &ActivityPrincipal::user(7),
            "activity-checkin-1",
            UpdateTeamCheckInConfigCommand {
                team_id: 1,
                enabled: true,
                radius_meters: 200,
                open_minutes_before: 90,
                close_minutes_after: 30,
            },
        )
        .await
        .expect("leader should be able to configure check-in");

    assert!(config.enabled);
    assert_eq!(config.radius_meters, 200);
    assert_eq!(config.open_minutes_before, 90);
    assert_eq!(config.close_minutes_after, 30);

    let saved = repository
        .find_team_checkin_config("activity-checkin-1", 1)
        .await
        .expect("repository lookup should succeed")
        .expect("config should be saved");
    assert_eq!(saved.updated_by_user_id, Some(7));
}

#[tokio::test]
async fn member_cannot_configure_checkin_for_team() {
    let (service, _, _) = build_service(sample_activity(), &[(1, 9, "member")]);

    let error = service
        .update_team_checkin_config(
            &ActivityPrincipal::user(9),
            "activity-checkin-1",
            UpdateTeamCheckInConfigCommand {
                team_id: 1,
                enabled: true,
                radius_meters: 150,
                open_minutes_before: 60,
                close_minutes_after: 45,
            },
        )
        .await
        .expect_err("member should not be able to configure check-in");

    assert_eq!(error, ActivityApplicationError::Forbidden);
}

#[tokio::test]
async fn user_cannot_check_in_outside_configured_radius() {
    let (service, _, _) = build_service(sample_activity(), &[(1, 11, "member"), (1, 7, "captain")]);

    service
        .update_team_checkin_config(
            &ActivityPrincipal::user(7),
            "activity-checkin-1",
            UpdateTeamCheckInConfigCommand {
                team_id: 1,
                enabled: true,
                radius_meters: 100,
                open_minutes_before: 120,
                close_minutes_after: 120,
            },
        )
        .await
        .expect("captain should configure check-in");

    let error = service
        .submit_check_in(
            &ActivityPrincipal::user(11),
            "activity-checkin-1",
            SubmitActivityCheckInCommand {
                team_id: 1,
                latitude: 30.676_000,
                longitude: 104.090_000,
                current_time: Some(
                    NaiveDate::from_ymd_opt(2026, 4, 18)
                        .unwrap()
                        .and_hms_opt(19, 30, 0)
                        .unwrap(),
                ),
            },
        )
        .await
        .expect_err("outside radius should be rejected");

    assert!(
        matches!(error, ActivityApplicationError::Validation(message) if message.contains("签到范围"))
    );
}

#[tokio::test]
async fn successful_check_in_is_recorded_and_cannot_repeat() {
    let (service, repository, _) =
        build_service(sample_activity(), &[(1, 13, "member"), (1, 7, "captain")]);

    service
        .update_team_checkin_config(
            &ActivityPrincipal::user(7),
            "activity-checkin-1",
            UpdateTeamCheckInConfigCommand {
                team_id: 1,
                enabled: true,
                radius_meters: 300,
                open_minutes_before: 120,
                close_minutes_after: 60,
            },
        )
        .await
        .expect("captain should configure check-in");

    let checked_in = service
        .submit_check_in(
            &ActivityPrincipal::user(13),
            "activity-checkin-1",
            SubmitActivityCheckInCommand {
                team_id: 1,
                latitude: 30.671_820,
                longitude: 104.082_170,
                current_time: Some(
                    NaiveDate::from_ymd_opt(2026, 4, 18)
                        .unwrap()
                        .and_hms_opt(19, 10, 0)
                        .unwrap(),
                ),
            },
        )
        .await
        .expect("check-in should succeed inside radius");

    assert_eq!(checked_in.user_id, 13);
    assert!(checked_in.distance_meters <= 5);

    let saved = repository
        .find_checkin_record("activity-checkin-1", 1, 13)
        .await
        .expect("repository lookup should succeed")
        .expect("check-in record should be stored");
    assert_eq!(saved.user_id, 13);

    let second_attempt = service
        .submit_check_in(
            &ActivityPrincipal::user(13),
            "activity-checkin-1",
            SubmitActivityCheckInCommand {
                team_id: 1,
                latitude: 30.671_820,
                longitude: 104.082_170,
                current_time: Some(
                    NaiveDate::from_ymd_opt(2026, 4, 18)
                        .unwrap()
                        .and_hms_opt(19, 15, 0)
                        .unwrap(),
                ),
            },
        )
        .await
        .expect_err("duplicate check-in should be rejected");

    assert!(
        matches!(second_attempt, ActivityApplicationError::Conflict(message) if message.contains("已签到"))
    );
}

#[tokio::test]
async fn default_checkin_time_uses_local_time_window() {
    let local_now = Local::now().naive_local();
    let activity = Activity {
        id: "activity-checkin-local-now".to_string(),
        cover: None,
        start_time: local_now - Duration::minutes(30),
        end_time: local_now + Duration::minutes(90),
        holding_date: local_now,
        location: "本地时间测试球场".to_string(),
        location_latitude: Some(30.671_821),
        location_longitude: Some(104.082_169),
        name: "本地时间签到测试".to_string(),
        opposing: Some("时间窗对手".to_string()),
        status: 1,
        description: None,
        home_team_id: Some(1),
        away_team_id: None,
        color: None,
        opposing_color: None,
        players_per_team: Some(7),
        match_kind: Some("external".to_string()),
        source_activity_id: None,
        team_registration_count: None,
        team_checkin_configs: vec![],
        created_at: local_now - Duration::days(1),
        updated_at: local_now - Duration::days(1),
    };
    let (service, _, _) = build_service(activity, &[(1, 15, "member"), (1, 7, "captain")]);

    service
        .update_team_checkin_config(
            &ActivityPrincipal::user(7),
            "activity-checkin-local-now",
            UpdateTeamCheckInConfigCommand {
                team_id: 1,
                enabled: true,
                radius_meters: 300,
                open_minutes_before: 60,
                close_minutes_after: 60,
            },
        )
        .await
        .expect("captain should configure check-in");

    let checked_in = service
        .submit_check_in(
            &ActivityPrincipal::user(15),
            "activity-checkin-local-now",
            SubmitActivityCheckInCommand {
                team_id: 1,
                latitude: 30.671_820,
                longitude: 104.082_170,
                current_time: None,
            },
        )
        .await
        .expect("default current time should be within local check-in window");

    assert_eq!(checked_in.user_id, 15);
}
