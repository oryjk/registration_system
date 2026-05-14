#[derive(Debug, Clone)]
pub struct CreateActivityCommand {
    pub cover: Option<String>,
    pub start_time: chrono::NaiveDateTime,
    pub end_time: chrono::NaiveDateTime,
    pub holding_date: chrono::NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub name: String,
    pub opposing: Option<String>,
    pub description: Option<String>,
    pub home_team_id: Option<i64>,
    pub away_team_id: Option<i64>,
    pub color: Option<String>,
    pub opposing_color: Option<String>,
    pub players_per_team: Option<i32>,
    pub match_kind: Option<String>,
    pub team_checkin_configs: Vec<CreateActivityCheckInConfigCommand>,
}

#[derive(Debug, Clone)]
pub struct CreateActivityCheckInConfigCommand {
    pub team_id: i64,
    pub enabled: bool,
    pub radius_meters: i32,
    pub open_minutes_before: i32,
    pub close_minutes_after: i32,
}

#[derive(Debug, Clone)]
pub struct UpdateMyStandCommand {
    pub stand: i8,
    pub registration_count: i32,
}

#[derive(Debug, Clone)]
pub struct UpdateActivityCommand {
    pub cover: Option<Option<String>>,
    pub start_time: Option<chrono::NaiveDateTime>,
    pub end_time: Option<chrono::NaiveDateTime>,
    pub holding_date: Option<chrono::NaiveDateTime>,
    pub location: Option<String>,
    pub location_latitude: Option<Option<f64>>,
    pub location_longitude: Option<Option<f64>>,
    pub name: Option<String>,
    pub opposing: Option<Option<String>>,
    pub description: Option<Option<String>>,
    pub home_team_id: Option<Option<i64>>,
    pub away_team_id: Option<Option<i64>>,
    pub color: Option<Option<String>>,
    pub opposing_color: Option<Option<String>>,
    pub players_per_team: Option<Option<i32>>,
    pub match_kind: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UpdateTeamCheckInConfigCommand {
    pub team_id: i64,
    pub enabled: bool,
    pub radius_meters: i32,
    pub open_minutes_before: i32,
    pub close_minutes_after: i32,
}

#[derive(Debug, Clone)]
pub struct SubmitActivityCheckInCommand {
    pub team_id: i64,
    pub latitude: f64,
    pub longitude: f64,
    pub current_time: Option<chrono::NaiveDateTime>,
}
