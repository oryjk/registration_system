use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration, RegistrationListPage,
    RegistrationWithInfo,
};
use crate::activity::ports::LocationSearchResult;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateActivityRequest {
    pub cover: Option<String>,
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
    pub holding_date: NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub name: String,
    pub opposing: Option<String>,
    pub description: Option<String>,
    pub home_team_id: Option<String>,
    pub away_team_id: Option<String>,
    pub color: Option<String>,
    pub opposing_color: Option<String>,
    pub players_per_team: Option<i32>,
    pub team_checkin_configs: Option<Vec<CreateActivityCheckInConfigRequest>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateActivityCheckInConfigRequest {
    pub team_id: String,
    pub enabled: bool,
    pub radius_meters: i32,
    pub open_minutes_before: i32,
    pub close_minutes_after: i32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateStatusRequest {
    pub status: i8,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateMyStandRequest {
    pub stand: i8,
    pub registration_count: i32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateTeamCheckInConfigRequest {
    pub team_id: String,
    pub enabled: bool,
    pub radius_meters: i32,
    pub open_minutes_before: i32,
    pub close_minutes_after: i32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SubmitActivityCheckInRequest {
    pub team_id: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct BatchDeleteActivitiesRequest {
    pub ids: Vec<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateActivityRequest {
    pub cover: Option<Option<String>>,
    pub start_time: Option<NaiveDateTime>,
    pub end_time: Option<NaiveDateTime>,
    pub holding_date: Option<NaiveDateTime>,
    pub location: Option<String>,
    pub location_latitude: Option<Option<f64>>,
    pub location_longitude: Option<Option<f64>>,
    pub name: Option<String>,
    pub opposing: Option<Option<String>>,
    pub description: Option<Option<String>>,
    pub home_team_id: Option<Option<String>>,
    pub away_team_id: Option<Option<String>>,
    pub color: Option<Option<String>>,
    pub opposing_color: Option<Option<String>>,
    pub players_per_team: Option<Option<i32>>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivityDto {
    pub id: String,
    pub name: String,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub status: i8,
    pub holding_date: NaiveDateTime,
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
    pub opposing: Option<String>,
    pub cover: Option<String>,
    pub description: Option<String>,
    pub home_team_id: Option<String>,
    pub away_team_id: Option<String>,
    pub color: Option<String>,
    pub opposing_color: Option<String>,
    pub players_per_team: Option<i32>,
    pub source_activity_id: Option<String>,
    pub team_registration_count: Option<i32>,
    pub team_checkin_configs: Vec<ActivityTeamCheckInConfigDto>,
}

impl From<Activity> for ActivityDto {
    fn from(value: Activity) -> Self {
        Self {
            id: value.id,
            name: value.name,
            location: value.location,
            location_latitude: value.location_latitude,
            location_longitude: value.location_longitude,
            status: value.status,
            holding_date: value.holding_date,
            start_time: value.start_time,
            end_time: value.end_time,
            opposing: value.opposing,
            cover: value.cover,
            description: value.description,
            home_team_id: value.home_team_id,
            away_team_id: value.away_team_id,
            color: value.color,
            opposing_color: value.opposing_color,
            players_per_team: value.players_per_team,
            source_activity_id: value.source_activity_id,
            team_registration_count: value.team_registration_count,
            team_checkin_configs: value
                .team_checkin_configs
                .into_iter()
                .map(|item| ActivityTeamCheckInConfigDto::from_config(item, value.holding_date))
                .collect(),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivityTeamCheckInConfigDto {
    pub team_id: String,
    pub enabled: bool,
    pub radius_meters: i32,
    pub open_minutes_before: i32,
    pub close_minutes_after: i32,
    pub checkin_open_at: NaiveDateTime,
    pub checkin_close_at: NaiveDateTime,
    pub updated_by_user_id: Option<i64>,
    pub updated_at: NaiveDateTime,
}

impl ActivityTeamCheckInConfigDto {
    pub fn from_config(
        value: crate::activity::domain::ActivityTeamCheckInConfig,
        holding_date: NaiveDateTime,
    ) -> Self {
        let checkin_open_at = value.checkin_open_at(holding_date);
        let checkin_close_at = value.checkin_close_at(holding_date);
        Self {
            team_id: value.team_id,
            enabled: value.enabled,
            radius_meters: value.radius_meters,
            open_minutes_before: value.open_minutes_before,
            close_minutes_after: value.close_minutes_after,
            checkin_open_at,
            checkin_close_at,
            updated_by_user_id: value.updated_by_user_id,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivityStatusCountsDto {
    pub total: i64,
    pub registering: i64,
    pub ongoing: i64,
    pub ended: i64,
    pub cancelled: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivityListPageDto {
    pub items: Vec<ActivityDto>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub counts: ActivityStatusCountsDto,
}

impl From<ActivityListPage> for ActivityListPageDto {
    fn from(v: ActivityListPage) -> Self {
        Self {
            items: v.items.into_iter().map(ActivityDto::from).collect(),
            total: v.total,
            page: v.page,
            page_size: v.page_size,
            counts: ActivityStatusCountsDto {
                total: v.counts.total,
                registering: v.counts.registering,
                ongoing: v.counts.ongoing,
                ended: v.counts.ended,
                cancelled: v.counts.cancelled,
            },
        }
    }
}

/// GET /activities 查询参数
#[derive(Debug, Deserialize, IntoParams)]
pub struct ListActivitiesQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    /// -1 或未传：全部；0–3：按活动状态筛选
    pub status: Option<i8>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct SearchLocationsQuery {
    pub keyword: String,
    pub limit: Option<u8>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct ResolveLocationQuery {
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LocationSearchResultDto {
    pub provider_place_id: String,
    pub title: String,
    pub address: String,
    pub display_name: String,
    pub latitude: String,
    pub longitude: String,
}

impl From<LocationSearchResult> for LocationSearchResultDto {
    fn from(value: LocationSearchResult) -> Self {
        Self {
            provider_place_id: value.provider_place_id,
            title: value.title,
            address: value.address,
            display_name: value.display_name,
            latitude: value.latitude,
            longitude: value.longitude,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RegistrationDto {
    pub user_id: i64,
    pub stand: i8,
    pub registration_count: i32,
    pub paid: i8,
    pub operation_time: NaiveDateTime,
    pub checked_in_at: Option<NaiveDateTime>,
    pub checkin_distance_meters: Option<i32>,
}

impl From<ActivityRegistration> for RegistrationDto {
    fn from(value: ActivityRegistration) -> Self {
        Self {
            user_id: value.user_id,
            stand: value.stand,
            registration_count: value.registration_count,
            paid: value.paid,
            operation_time: value.operation_time,
            checked_in_at: value.checked_in_at,
            checkin_distance_meters: value.checkin_distance_meters,
        }
    }
}

/// 管理后台：含球员信息的报名记录
#[derive(Debug, Serialize, ToSchema)]
pub struct RegistrationWithInfoDto {
    pub user_id: i64,
    pub stand: i8,
    pub stand_label: String,
    pub registration_count: i32,
    pub paid: i8,
    pub operation_time: NaiveDateTime,
    pub checked_in_at: Option<NaiveDateTime>,
    pub checkin_distance_meters: Option<i32>,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
}

impl From<RegistrationWithInfo> for RegistrationWithInfoDto {
    fn from(v: RegistrationWithInfo) -> Self {
        let stand_label = match v.stand {
            1 => "参加".to_string(),
            2 => "请假".to_string(),
            3 => "迟到".to_string(),
            _ => "未表态".to_string(),
        };
        Self {
            user_id: v.user_id,
            stand: v.stand,
            stand_label,
            registration_count: v.registration_count,
            paid: v.paid,
            operation_time: v.operation_time,
            checked_in_at: v.checked_in_at,
            checkin_distance_meters: v.checkin_distance_meters,
            nickname: v.nickname,
            real_name: v.real_name,
            avatar_url: v.avatar_url,
            phone_number: v.phone_number,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RegistrationStandCountsDto {
    pub total: i64,
    pub unknown: i64,
    pub attending: i64,
    pub leave: i64,
    pub absent: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RegistrationListPageDto {
    pub items: Vec<RegistrationWithInfoDto>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub counts: RegistrationStandCountsDto,
}

impl From<RegistrationListPage> for RegistrationListPageDto {
    fn from(v: RegistrationListPage) -> Self {
        Self {
            items: v
                .items
                .into_iter()
                .map(RegistrationWithInfoDto::from)
                .collect(),
            total: v.total,
            page: v.page,
            page_size: v.page_size,
            counts: RegistrationStandCountsDto {
                total: v.counts.total,
                unknown: v.counts.unknown,
                attending: v.counts.attending,
                leave: v.counts.leave,
                absent: v.counts.absent,
            },
        }
    }
}

/// GET …/registrations 查询参数
#[derive(Debug, Deserialize, IntoParams)]
pub struct ListRegistrationsQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    /// -1 或未传：全部；0–3：按报名状态筛选
    pub stand: Option<i8>,
}

/// 管理员手动报名请求
#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminRegisterRequest {
    pub user_id: i64,
    pub stand: i8,
    pub registration_count: Option<i32>,
}

/// 管理员批量修改报名状态请求
#[derive(Debug, Deserialize, ToSchema)]
pub struct BatchUpdateStandRequest {
    pub user_ids: Vec<i64>,
    pub stand: i8,
    pub registration_count: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TeamRegistrationRequest {
    pub team_id: String,
    pub registration_count: i32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TeamRegistrationCancelRequest {
    pub team_id: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OngoingActivityDto {
    pub has_ongoing: bool,
    pub activity: Option<ActivityDto>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct BackfillActivityDto {
    pub activity_id: String,
    pub backfilled_count: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivityCheckInRecordDto {
    pub activity_id: String,
    pub team_id: String,
    pub user_id: i64,
    pub distance_meters: i32,
    pub checked_in_at: NaiveDateTime,
}

impl From<ActivityCheckInRecord> for ActivityCheckInRecordDto {
    fn from(value: ActivityCheckInRecord) -> Self {
        Self {
            activity_id: value.activity_id,
            team_id: value.team_id,
            user_id: value.user_id,
            distance_meters: value.distance_meters,
            checked_in_at: value.checked_in_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DeleteRegistrationResultDto {
    pub deleted_rows: u64,
}
