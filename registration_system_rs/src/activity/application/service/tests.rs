use super::ActivityService;
use crate::activity::application::error::ActivityApplicationError;
use crate::activity::application::principal::ActivityPrincipal;
use crate::activity::application::validation::{
    is_frozen_during_activity, is_hex_color, validate_optional_hex_color,
};
use crate::activity::application::{
    CreateActivityCheckInConfigCommand, CreateActivityCommand, UpdateActivityCommand,
    UpdateMyStandCommand,
};
use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
    ActivityTeamCheckInConfig, DomainError, RegistrationListPage, UpdateActivityFields,
};
use crate::activity::ports::{
    ActivityCommandRepository, ActivityQueryRepository, ActivityTeamAccessPort,
    LocationSearchGateway, LocationSearchResult,
};
use async_trait::async_trait;
use chrono::{Duration, Utc};
use std::sync::{Arc, Mutex};

struct DummyActivityRepository;
struct DummyTeamAccessPort;

struct TeamManagerAccessPort;

struct DummyLocationGateway;

#[async_trait]
impl LocationSearchGateway for DummyLocationGateway {
    async fn search_locations(
        &self,
        _keyword: &str,
        _limit: u8,
    ) -> Result<Vec<LocationSearchResult>, String> {
        Ok(vec![LocationSearchResult {
            provider_place_id: "poi-1".to_string(),
            title: "深圳湾体育中心".to_string(),
            address: "深圳市南山区滨海大道".to_string(),
            display_name: "深圳湾体育中心 · 深圳市南山区滨海大道".to_string(),
            latitude: "22.518014".to_string(),
            longitude: "113.947308".to_string(),
        }])
    }

    async fn resolve_location(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<LocationSearchResult, String> {
        Ok(LocationSearchResult {
            provider_place_id: "poi-resolved".to_string(),
            title: "腾讯滨海大厦".to_string(),
            address: "深圳市南山区科技南一路".to_string(),
            display_name: "腾讯滨海大厦 · 深圳市南山区科技南一路".to_string(),
            latitude: latitude.to_string(),
            longitude: longitude.to_string(),
        })
    }
}

#[async_trait]
impl ActivityQueryRepository for DummyActivityRepository {
    async fn list_page(
        &self,
        _status_filter: Option<i8>,
        _page: u32,
        _page_size: u32,
    ) -> Result<ActivityListPage, DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn find_by_id(&self, _activity_id: &str) -> Result<Option<Activity>, DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn find_derived_by_source_and_team(
        &self,
        _source_activity_id: &str,
        _team_id: i64,
    ) -> Result<Option<Activity>, DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn find_ongoing_activity(&self) -> Result<Option<Activity>, DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn list_registrations(
        &self,
        _activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn count_capacity_registrations(&self, _activity_id: &str) -> Result<i64, DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn list_registrations_with_info_page(
        &self,
        _activity_id: &str,
        _activity_holding_date: chrono::NaiveDateTime,
        _stand_filter: Option<i8>,
        _page: u32,
        _page_size: u32,
    ) -> Result<RegistrationListPage, DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn list_team_checkin_configs(
        &self,
        _activity_id: &str,
    ) -> Result<Vec<ActivityTeamCheckInConfig>, DomainError> {
        Ok(Vec::new())
    }

    async fn find_team_checkin_config(
        &self,
        _activity_id: &str,
        _team_id: i64,
    ) -> Result<Option<ActivityTeamCheckInConfig>, DomainError> {
        Ok(None)
    }

    async fn find_checkin_record(
        &self,
        _activity_id: &str,
        _team_id: i64,
        _user_id: i64,
    ) -> Result<Option<ActivityCheckInRecord>, DomainError> {
        Ok(None)
    }
}

#[async_trait]
impl ActivityCommandRepository for DummyActivityRepository {
    async fn create(&self, _activity: &Activity) -> Result<(), DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn delete_many(&self, _ids: &[String]) -> Result<(), DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn update_status(&self, _activity_id: &str, _status: i8) -> Result<(), DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn update_activity(
        &self,
        _activity_id: &str,
        _fields: UpdateActivityFields<'_>,
    ) -> Result<(), DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn upsert_registration(
        &self,
        _activity_id: &str,
        _user_id: i64,
        _stand: i8,
        _registration_count: i32,
    ) -> Result<(), DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn delete_registration(
        &self,
        _activity_id: &str,
        _user_id: i64,
    ) -> Result<u64, DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn backfill_team_member_registrations(
        &self,
        _activity_id: &str,
    ) -> Result<u64, DomainError> {
        unreachable!("search_locations does not use repository")
    }

    async fn upsert_team_checkin_config(
        &self,
        _config: &ActivityTeamCheckInConfig,
    ) -> Result<(), DomainError> {
        Ok(())
    }

    async fn record_checkin(
        &self,
        record: &ActivityCheckInRecord,
    ) -> Result<ActivityCheckInRecord, DomainError> {
        Ok(record.clone())
    }
}

#[async_trait]
impl ActivityTeamAccessPort for DummyTeamAccessPort {
    async fn find_active_member_role(
        &self,
        _team_id: i64,
        _user_id: i64,
    ) -> Result<Option<String>, String> {
        Ok(None)
    }
}

#[async_trait]
impl ActivityTeamAccessPort for TeamManagerAccessPort {
    async fn find_active_member_role(
        &self,
        _team_id: i64,
        _user_id: i64,
    ) -> Result<Option<String>, String> {
        Ok(Some("captain".to_string()))
    }
}

#[derive(Default)]
struct RecordingActivityRepository {
    created: Mutex<Vec<Activity>>,
    found_activity: Mutex<Option<Activity>>,
    derived_activity: Mutex<Option<Activity>>,
    updated: Mutex<Vec<RecordedUpdate>>,
    status_updates: Mutex<Vec<(String, i8)>>,
    upserted_registrations: Mutex<Vec<RecordedRegistration>>,
    deleted_registrations: Mutex<Vec<(String, i64)>>,
    created_checkin_configs: Mutex<Vec<ActivityTeamCheckInConfig>>,
}

#[derive(Debug, Clone, PartialEq)]
struct RecordedUpdate {
    activity_id: String,
    location_latitude: Option<Option<f64>>,
    location_longitude: Option<Option<f64>>,
    players_per_team: Option<Option<i32>>,
    match_kind: Option<String>,
    team_registration_count: Option<Option<i32>>,
}

#[derive(Debug, Clone, PartialEq)]
struct RecordedRegistration {
    activity_id: String,
    user_id: i64,
    stand: i8,
    registration_count: i32,
}

#[async_trait]
impl ActivityQueryRepository for RecordingActivityRepository {
    async fn list_page(
        &self,
        _status_filter: Option<i8>,
        _page: u32,
        _page_size: u32,
    ) -> Result<ActivityListPage, DomainError> {
        unreachable!("not used in this test")
    }

    async fn find_by_id(&self, _activity_id: &str) -> Result<Option<Activity>, DomainError> {
        Ok(self
            .found_activity
            .lock()
            .expect("found_activity mutex poisoned")
            .clone())
    }

    async fn find_derived_by_source_and_team(
        &self,
        _source_activity_id: &str,
        _team_id: i64,
    ) -> Result<Option<Activity>, DomainError> {
        Ok(self
            .derived_activity
            .lock()
            .expect("derived_activity mutex poisoned")
            .clone())
    }

    async fn find_ongoing_activity(&self) -> Result<Option<Activity>, DomainError> {
        unreachable!("not used in this test")
    }

    async fn list_registrations(
        &self,
        _activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, DomainError> {
        Ok(Vec::new())
    }

    async fn count_capacity_registrations(&self, _activity_id: &str) -> Result<i64, DomainError> {
        Ok(0)
    }

    async fn list_registrations_with_info_page(
        &self,
        _activity_id: &str,
        _activity_holding_date: chrono::NaiveDateTime,
        _stand_filter: Option<i8>,
        _page: u32,
        _page_size: u32,
    ) -> Result<RegistrationListPage, DomainError> {
        unreachable!("not used in this test")
    }

    async fn list_team_checkin_configs(
        &self,
        _activity_id: &str,
    ) -> Result<Vec<ActivityTeamCheckInConfig>, DomainError> {
        Ok(Vec::new())
    }

    async fn find_team_checkin_config(
        &self,
        _activity_id: &str,
        _team_id: i64,
    ) -> Result<Option<ActivityTeamCheckInConfig>, DomainError> {
        Ok(None)
    }

    async fn find_checkin_record(
        &self,
        _activity_id: &str,
        _team_id: i64,
        _user_id: i64,
    ) -> Result<Option<ActivityCheckInRecord>, DomainError> {
        Ok(None)
    }
}

#[async_trait]
impl ActivityCommandRepository for RecordingActivityRepository {
    async fn create(&self, activity: &Activity) -> Result<(), DomainError> {
        self.created
            .lock()
            .expect("created mutex poisoned")
            .push(activity.clone());
        Ok(())
    }

    async fn delete_many(&self, _ids: &[String]) -> Result<(), DomainError> {
        unreachable!("not used in this test")
    }

    async fn update_status(&self, _activity_id: &str, _status: i8) -> Result<(), DomainError> {
        self.status_updates
            .lock()
            .expect("status_updates mutex poisoned")
            .push((_activity_id.to_string(), _status));
        Ok(())
    }

    async fn update_activity(
        &self,
        activity_id: &str,
        fields: UpdateActivityFields<'_>,
    ) -> Result<(), DomainError> {
        self.updated
            .lock()
            .expect("updated mutex poisoned")
            .push(RecordedUpdate {
                activity_id: activity_id.to_string(),
                location_latitude: fields.location_latitude,
                location_longitude: fields.location_longitude,
                players_per_team: fields.players_per_team,
                match_kind: fields.match_kind.map(str::to_string),
                team_registration_count: fields.team_registration_count,
            });
        Ok(())
    }

    async fn upsert_registration(
        &self,
        activity_id: &str,
        user_id: i64,
        stand: i8,
        registration_count: i32,
    ) -> Result<(), DomainError> {
        self.upserted_registrations
            .lock()
            .expect("upserted_registrations mutex poisoned")
            .push(RecordedRegistration {
                activity_id: activity_id.to_string(),
                user_id,
                stand,
                registration_count,
            });
        Ok(())
    }

    async fn delete_registration(
        &self,
        activity_id: &str,
        user_id: i64,
    ) -> Result<u64, DomainError> {
        self.deleted_registrations
            .lock()
            .expect("deleted_registrations mutex poisoned")
            .push((activity_id.to_string(), user_id));
        Ok(1)
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
        self.created_checkin_configs
            .lock()
            .expect("created_checkin_configs mutex poisoned")
            .push(config.clone());
        Ok(())
    }

    async fn record_checkin(
        &self,
        record: &ActivityCheckInRecord,
    ) -> Result<ActivityCheckInRecord, DomainError> {
        Ok(record.clone())
    }
}

#[test]
fn accepts_valid_hex_colors() {
    assert!(is_hex_color("#A1B2C3"));
    assert_eq!(
        validate_optional_hex_color(Some("#a1b2c3".to_string()), "球服颜色").unwrap(),
        Some("#A1B2C3".to_string())
    );
}

#[test]
fn treats_blank_hex_colors_as_none() {
    assert_eq!(
        validate_optional_hex_color(Some("   ".to_string()), "球服颜色").unwrap(),
        None
    );
}

#[test]
fn rejects_invalid_hex_colors() {
    assert_eq!(
        validate_optional_hex_color(Some("white".to_string()), "球服颜色"),
        Err(ActivityApplicationError::Validation(
            "球服颜色必须是 #RRGGBB 格式".to_string()
        ))
    );
}

#[test]
fn detects_user_as_frozen_when_holding_date_is_inside_freeze_window() {
    let holding_date = Utc::now().naive_utc();

    assert!(is_frozen_during_activity(
        holding_date,
        Some(holding_date - Duration::hours(2)),
        Some(holding_date + Duration::hours(2)),
    ));
}

#[test]
fn detects_user_as_not_frozen_when_holding_date_is_outside_freeze_window() {
    let holding_date = Utc::now().naive_utc();

    assert!(!is_frozen_during_activity(
        holding_date,
        Some(holding_date + Duration::hours(1)),
        Some(holding_date + Duration::hours(3)),
    ));
    assert!(!is_frozen_during_activity(
        holding_date,
        Some(holding_date - Duration::hours(3)),
        Some(holding_date - Duration::hours(1)),
    ));
}

#[test]
fn treats_open_ended_freeze_as_covering_future_activity_dates() {
    let holding_date = Utc::now().naive_utc();

    assert!(is_frozen_during_activity(
        holding_date,
        Some(holding_date - Duration::days(1)),
        None,
    ));
}

#[tokio::test]
async fn returns_actionable_error_when_location_gateway_is_not_configured() {
    let service = ActivityService::new(
        Arc::new(DummyActivityRepository),
        Arc::new(DummyActivityRepository),
        None,
        Arc::new(DummyTeamAccessPort),
    );
    let error = service
        .search_locations(&ActivityPrincipal::admin(1, true), "迟到", 8)
        .await
        .expect_err("expected missing gateway to fail");

    assert_eq!(
        error,
        ActivityApplicationError::Internal(
            "地点搜索服务未配置，请在后端 .env 中设置 TENCENT_MAP_KEY 或 AMAP_WEB_KEY".to_string()
        )
    );
}

#[tokio::test]
async fn update_my_stand_zero_deletes_current_user_registration() {
    let repository = Arc::new(RecordingActivityRepository::default());
    let service = ActivityService::new(
        repository.clone(),
        repository.clone(),
        None,
        Arc::new(DummyTeamAccessPort),
    );

    service
        .update_my_stand(
            &ActivityPrincipal::user(7),
            "activity-1",
            UpdateMyStandCommand {
                stand: 0,
                registration_count: 0,
            },
        )
        .await
        .expect("cancel should succeed");

    assert_eq!(
        repository
            .deleted_registrations
            .lock()
            .expect("deleted_registrations mutex poisoned")
            .as_slice(),
        &[("activity-1".to_string(), 7)]
    );
    assert!(
        repository
            .upserted_registrations
            .lock()
            .expect("upserted_registrations mutex poisoned")
            .is_empty()
    );
}

#[tokio::test]
async fn update_my_stand_attending_upserts_current_user_registration() {
    let repository = Arc::new(RecordingActivityRepository::default());
    let now = Utc::now().naive_utc();
    *repository
        .found_activity
        .lock()
        .expect("found_activity mutex poisoned") = Some(Activity {
        id: "activity-1".to_string(),
        cover: None,
        start_time: now,
        end_time: now + Duration::hours(2),
        holding_date: now,
        location: "测试球场".to_string(),
        location_latitude: None,
        location_longitude: None,
        name: "测试比赛".to_string(),
        opposing: None,
        status: 0,
        description: None,
        home_team_id: None,
        away_team_id: None,
        color: None,
        opposing_color: None,
        players_per_team: Some(7),
        match_kind: Some("external".to_string()),
        source_activity_id: None,
        team_registration_count: None,
        team_checkin_configs: vec![],
        created_at: now,
        updated_at: now,
    });
    let service = ActivityService::new(
        repository.clone(),
        repository.clone(),
        None,
        Arc::new(DummyTeamAccessPort),
    );

    service
        .update_my_stand(
            &ActivityPrincipal::user(7),
            "activity-1",
            UpdateMyStandCommand {
                stand: 1,
                registration_count: 1,
            },
        )
        .await
        .expect("signup should succeed");

    assert_eq!(
        repository
            .upserted_registrations
            .lock()
            .expect("upserted_registrations mutex poisoned")
            .as_slice(),
        &[RecordedRegistration {
            activity_id: "activity-1".to_string(),
            user_id: 7,
            stand: 1,
            registration_count: 1,
        }]
    );
    assert!(
        repository
            .deleted_registrations
            .lock()
            .expect("deleted_registrations mutex poisoned")
            .is_empty()
    );
}

#[tokio::test]
async fn cancel_team_registration_marks_derived_activity_cancelled() {
    let repository = Arc::new(RecordingActivityRepository::default());
    let now = Utc::now().naive_utc();
    *repository
        .derived_activity
        .lock()
        .expect("derived_activity mutex poisoned") = Some(Activity {
        id: "derived-1".to_string(),
        cover: None,
        start_time: now,
        end_time: now + Duration::hours(2),
        holding_date: now,
        location: "测试球场".to_string(),
        location_latitude: None,
        location_longitude: None,
        name: "队内报名".to_string(),
        opposing: None,
        status: 0,
        description: None,
        home_team_id: Some(1),
        away_team_id: None,
        color: None,
        opposing_color: None,
        players_per_team: Some(7),
        match_kind: Some("external".to_string()),
        source_activity_id: Some("activity-1".to_string()),
        team_registration_count: Some(7),
        team_checkin_configs: vec![],
        created_at: now,
        updated_at: now,
    });
    let service = ActivityService::new(
        repository.clone(),
        repository.clone(),
        None,
        Arc::new(TeamManagerAccessPort),
    );

    service
        .cancel_team_registration(&ActivityPrincipal::user(7), "activity-1", 1)
        .await
        .expect("cancel should succeed");

    assert_eq!(
        repository
            .status_updates
            .lock()
            .expect("status_updates mutex poisoned")
            .as_slice(),
        &[("derived-1".to_string(), 3)]
    );
}

#[tokio::test]
async fn create_activity_persists_location_coordinates() {
    let repository = Arc::new(RecordingActivityRepository::default());
    let service = ActivityService::new(
        repository.clone(),
        repository.clone(),
        None,
        Arc::new(DummyTeamAccessPort),
    );
    let now = Utc::now().naive_utc();

    let activity = service
        .create_activity(
            &ActivityPrincipal::admin(1, true),
            CreateActivityCommand {
                cover: None,
                start_time: now,
                end_time: now + Duration::hours(2),
                holding_date: now + Duration::days(1),
                location: "深圳湾体育中心".to_string(),
                location_latitude: Some(22.518014),
                location_longitude: Some(113.947308),
                name: "周四友谊赛".to_string(),
                opposing: None,
                description: None,
                home_team_id: None,
                away_team_id: None,
                color: None,
                opposing_color: None,
                players_per_team: None,
                match_kind: None,
                team_checkin_configs: vec![],
            },
        )
        .await
        .expect("create should succeed");

    let created = repository.created.lock().expect("created mutex poisoned");
    assert_eq!(created.len(), 1);
    assert_eq!(created[0].id, activity.id);
    assert_eq!(created[0].location_latitude, Some(22.518014));
    assert_eq!(created[0].location_longitude, Some(113.947308));
}

#[tokio::test]
async fn create_activity_persists_match_kind() {
    let repository = Arc::new(RecordingActivityRepository::default());
    let service = ActivityService::new(
        repository.clone(),
        repository.clone(),
        None,
        Arc::new(DummyTeamAccessPort),
    );
    let now = Utc::now().naive_utc();

    let activity = service
        .create_activity(
            &ActivityPrincipal::admin(1, true),
            CreateActivityCommand {
                cover: None,
                start_time: now,
                end_time: now + Duration::hours(2),
                holding_date: now + Duration::days(1),
                location: "深圳湾体育中心".to_string(),
                location_latitude: None,
                location_longitude: None,
                name: "队内训练赛".to_string(),
                opposing: None,
                description: None,
                home_team_id: None,
                away_team_id: None,
                color: None,
                opposing_color: None,
                players_per_team: None,
                match_kind: Some("internal".to_string()),
                team_checkin_configs: vec![],
            },
        )
        .await
        .expect("create should succeed");

    assert_eq!(activity.match_kind.as_deref(), Some("internal"));
    let created = repository.created.lock().expect("created mutex poisoned");
    assert_eq!(created[0].match_kind.as_deref(), Some("internal"));
}

#[tokio::test]
async fn team_manager_can_create_activity_with_initial_checkin_config() {
    let repository = Arc::new(RecordingActivityRepository::default());
    let service = ActivityService::new(
        repository.clone(),
        repository.clone(),
        None,
        Arc::new(TeamManagerAccessPort),
    );
    let now = Utc::now().naive_utc();

    let activity = service
        .create_activity(
            &ActivityPrincipal::user(7),
            CreateActivityCommand {
                cover: None,
                start_time: now,
                end_time: now + Duration::hours(2),
                holding_date: now + Duration::days(1),
                location: "深圳湾体育中心".to_string(),
                location_latitude: Some(22.518014),
                location_longitude: Some(113.947308),
                name: "队长发起的周四友谊赛".to_string(),
                opposing: None,
                description: None,
                home_team_id: Some(1),
                away_team_id: None,
                color: None,
                opposing_color: None,
                players_per_team: Some(8),
                match_kind: None,
                team_checkin_configs: vec![CreateActivityCheckInConfigCommand {
                    team_id: 1,
                    enabled: true,
                    radius_meters: 200,
                    open_minutes_before: 60,
                    close_minutes_after: 45,
                }],
            },
        )
        .await
        .expect("create should succeed");

    assert_eq!(activity.team_checkin_configs.len(), 1);
    assert_eq!(activity.team_checkin_configs[0].team_id, 1);
    assert!(activity.team_checkin_configs[0].enabled);

    let created_configs = repository
        .created_checkin_configs
        .lock()
        .expect("created_checkin_configs mutex poisoned");
    assert_eq!(created_configs.len(), 1);
    assert_eq!(created_configs[0].activity_id, activity.id);
    assert_eq!(created_configs[0].radius_meters, 200);
}

#[tokio::test]
async fn resolves_location_name_from_coordinates() {
    let service = ActivityService::new(
        Arc::new(DummyActivityRepository),
        Arc::new(DummyActivityRepository),
        Some(Arc::new(DummyLocationGateway)),
        Arc::new(DummyTeamAccessPort),
    );

    let resolved = service
        .resolve_location(&ActivityPrincipal::admin(1, true), 22.5401, 113.9345)
        .await
        .expect("resolve should succeed");

    assert_eq!(resolved.title, "腾讯滨海大厦");
    assert_eq!(resolved.latitude, "22.5401");
    assert_eq!(resolved.longitude, "113.9345");
}

#[tokio::test]
async fn app_user_can_resolve_location_name_from_coordinates() {
    let service = ActivityService::new(
        Arc::new(DummyActivityRepository),
        Arc::new(DummyActivityRepository),
        Some(Arc::new(DummyLocationGateway)),
        Arc::new(DummyTeamAccessPort),
    );

    let resolved = service
        .resolve_location(&ActivityPrincipal::user(7), 22.5401, 113.9345)
        .await
        .expect("app user resolve should succeed");

    assert_eq!(resolved.title, "腾讯滨海大厦");
    assert_eq!(resolved.latitude, "22.5401");
    assert_eq!(resolved.longitude, "113.9345");
}

#[tokio::test]
async fn update_activity_can_clear_location_coordinates() {
    let repository = Arc::new(RecordingActivityRepository::default());
    let service = ActivityService::new(
        repository.clone(),
        repository.clone(),
        None,
        Arc::new(DummyTeamAccessPort),
    );

    service
        .update_activity(
            &ActivityPrincipal::admin(1, true),
            "activity-1",
            UpdateActivityCommand {
                cover: None,
                start_time: None,
                end_time: None,
                holding_date: None,
                location: None,
                location_latitude: Some(None),
                location_longitude: Some(None),
                name: None,
                opposing: None,
                description: None,
                home_team_id: None,
                away_team_id: None,
                color: None,
                opposing_color: None,
                players_per_team: None,
                match_kind: None,
            },
        )
        .await
        .expect("update should succeed");

    let updated = repository.updated.lock().expect("updated mutex poisoned");
    assert_eq!(
        updated[0],
        RecordedUpdate {
            activity_id: "activity-1".to_string(),
            location_latitude: Some(None),
            location_longitude: Some(None),
            players_per_team: None,
            match_kind: None,
            team_registration_count: None,
        }
    );
}

#[tokio::test]
async fn team_manager_can_update_own_future_activity() {
    let repository = Arc::new(RecordingActivityRepository::default());
    let now = Utc::now().naive_utc();
    *repository
        .found_activity
        .lock()
        .expect("found_activity mutex poisoned") = Some(Activity {
        id: "activity-1".to_string(),
        cover: None,
        start_time: now + Duration::days(1),
        end_time: now + Duration::days(1) + Duration::hours(2),
        holding_date: now + Duration::days(1),
        location: "旧球场".to_string(),
        location_latitude: None,
        location_longitude: None,
        name: "旧比赛".to_string(),
        opposing: None,
        status: 0,
        description: None,
        home_team_id: Some(1),
        away_team_id: None,
        color: None,
        opposing_color: None,
        players_per_team: Some(8),
        match_kind: Some("external".to_string()),
        source_activity_id: None,
        team_registration_count: None,
        team_checkin_configs: vec![],
        created_at: now,
        updated_at: now,
    });
    let service = ActivityService::new(
        repository.clone(),
        repository.clone(),
        None,
        Arc::new(TeamManagerAccessPort),
    );

    service
        .update_activity(
            &ActivityPrincipal::user(7),
            "activity-1",
            UpdateActivityCommand {
                cover: None,
                start_time: Some(now + Duration::days(2)),
                end_time: Some(now + Duration::days(2) + Duration::hours(2)),
                holding_date: Some(now + Duration::days(2)),
                location: Some("新球场".to_string()),
                location_latitude: Some(Some(22.1)),
                location_longitude: Some(Some(113.9)),
                name: Some("新比赛".to_string()),
                opposing: Some(Some("新对手".to_string())),
                description: None,
                home_team_id: None,
                away_team_id: None,
                color: Some(Some("#2f6bff".to_string())),
                opposing_color: Some(Some("#d9ff16".to_string())),
                players_per_team: Some(Some(8)),
                match_kind: Some("external".to_string()),
            },
        )
        .await
        .expect("team manager should update own future activity");

    let updated = repository.updated.lock().expect("updated mutex poisoned");
    assert_eq!(updated.len(), 1);
    assert_eq!(updated[0].activity_id, "activity-1");
    assert_eq!(updated[0].match_kind.as_deref(), Some("external"));
}
