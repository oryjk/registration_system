use chrono::NaiveDateTime;

/// repository `update_activity` 使用的部分更新字段（None = 不修改）
#[derive(Debug, Default)]
pub struct UpdateActivityFields<'a> {
    pub name: Option<&'a str>,
    pub cover: Option<Option<&'a str>>,
    pub start_time: Option<NaiveDateTime>,
    pub end_time: Option<NaiveDateTime>,
    pub holding_date: Option<NaiveDateTime>,
    pub location: Option<&'a str>,
    pub location_latitude: Option<Option<f64>>,
    pub location_longitude: Option<Option<f64>>,
    pub opposing: Option<Option<&'a str>>,
    pub description: Option<Option<&'a str>>,
    pub home_team_id: Option<Option<i64>>,
    pub away_team_id: Option<Option<i64>>,
    pub color: Option<Option<&'a str>>,
    pub opposing_color: Option<Option<&'a str>>,
    pub players_per_team: Option<Option<i32>>,
    pub match_kind: Option<&'a str>,
    pub source_activity_id: Option<Option<&'a str>>,
    pub team_registration_count: Option<Option<i32>>,
}

/// 活动下各报名状态人数（管理后台统计条）
#[derive(Debug, Clone)]
pub struct RegistrationStandCounts {
    pub total: i64,
    pub unknown: i64,
    pub attending: i64,
    pub leave: i64,
    pub absent: i64,
}

/// 活动列表各状态数量（全库统计，不受分页筛选影响）
#[derive(Debug, Clone)]
pub struct ActivityStatusCounts {
    pub total: i64,
    pub registering: i64,
    pub ongoing: i64,
    pub ended: i64,
    pub cancelled: i64,
}

/// 分页活动列表（管理后台）
#[derive(Debug, Clone)]
pub struct ActivityListPage {
    pub items: Vec<Activity>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub counts: ActivityStatusCounts,
}

/// 分页报名列表（管理后台）
#[derive(Debug, Clone)]
pub struct RegistrationListPage {
    pub items: Vec<RegistrationWithInfo>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub counts: RegistrationStandCounts,
}

/// 报名记录 + 球员基本信息（管理后台用）
#[derive(Debug, Clone)]
pub struct RegistrationWithInfo {
    pub user_id: i64,
    pub stand: i8,
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

#[derive(Debug, Clone)]
pub struct Activity {
    pub id: String,
    pub cover: Option<String>,
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
    pub holding_date: NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub name: String,
    pub opposing: Option<String>,
    pub status: i8,
    pub description: Option<String>,
    pub home_team_id: Option<i64>,
    pub away_team_id: Option<i64>,
    pub color: Option<String>,
    pub opposing_color: Option<String>,
    pub players_per_team: Option<i32>,
    pub match_kind: Option<String>,
    pub source_activity_id: Option<String>,
    pub team_registration_count: Option<i32>,
    pub team_checkin_configs: Vec<ActivityTeamCheckInConfig>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct ActivityRegistration {
    pub id: i64,
    pub activity_id: String,
    pub user_id: i64,
    pub stand: i8,
    pub registration_count: i32,
    pub paid: i8,
    pub operation_time: NaiveDateTime,
    pub checked_in_at: Option<NaiveDateTime>,
    pub checkin_distance_meters: Option<i32>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct ActivityTeamCheckInConfig {
    pub activity_id: String,
    pub team_id: i64,
    pub enabled: bool,
    pub radius_meters: i32,
    pub open_minutes_before: i32,
    pub close_minutes_after: i32,
    pub updated_by_user_id: Option<i64>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl ActivityTeamCheckInConfig {
    pub fn checkin_open_at(&self, holding_date: NaiveDateTime) -> NaiveDateTime {
        holding_date - chrono::Duration::minutes(self.open_minutes_before as i64)
    }

    pub fn checkin_close_at(&self, holding_date: NaiveDateTime) -> NaiveDateTime {
        holding_date + chrono::Duration::minutes(self.close_minutes_after as i64)
    }
}

#[derive(Debug, Clone)]
pub struct ActivityCheckInRecord {
    pub id: i64,
    pub activity_id: String,
    pub team_id: i64,
    pub user_id: i64,
    pub latitude: f64,
    pub longitude: f64,
    pub distance_meters: i32,
    pub checked_in_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
