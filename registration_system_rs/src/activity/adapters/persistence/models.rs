use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityRegistration, ActivityTeamCheckInConfig,
};
use chrono::NaiveDateTime;
use sqlx::FromRow;

pub(super) const ACTIVITY_COLS: &str = "id, cover, start_time, end_time, holding_date, location, location_latitude, location_longitude, name, opposing, status, description, home_team_id, away_team_id, color, opposing_color, players_per_team, team_capacity_limit, match_kind, source_activity_id, team_registration_count, created_at, updated_at";

#[derive(Debug, FromRow)]
pub(super) struct ActivityRow {
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
    pub status: i16,
    pub description: Option<String>,
    pub home_team_id: Option<i64>,
    pub away_team_id: Option<i64>,
    pub color: Option<String>,
    pub opposing_color: Option<String>,
    pub players_per_team: Option<i32>,
    pub team_capacity_limit: Option<i32>,
    pub match_kind: Option<String>,
    pub source_activity_id: Option<String>,
    pub team_registration_count: Option<i32>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

pub(super) fn trim_activity_id(value: &str) -> String {
    value.trim_end().to_string()
}

impl From<ActivityRow> for Activity {
    fn from(row: ActivityRow) -> Self {
        Self {
            id: trim_activity_id(&row.id),
            cover: row.cover,
            start_time: row.start_time,
            end_time: row.end_time,
            holding_date: row.holding_date,
            location: row.location,
            location_latitude: row.location_latitude,
            location_longitude: row.location_longitude,
            name: row.name,
            opposing: row.opposing,
            status: row.status as i8,
            description: row.description,
            home_team_id: row.home_team_id,
            away_team_id: row.away_team_id,
            color: row.color,
            opposing_color: row.opposing_color,
            players_per_team: row.players_per_team,
            team_capacity_limit: row.team_capacity_limit,
            match_kind: row.match_kind,
            source_activity_id: row.source_activity_id.map(|value| trim_activity_id(&value)),
            team_registration_count: row.team_registration_count,
            registration_preview: Default::default(),
            team_checkin_configs: vec![],
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub(super) struct ActivityRegistrationRow {
    pub id: i64,
    pub activity_id: String,
    pub user_id: i64,
    pub stand: i16,
    pub registration_count: i32,
    pub paid: i16,
    pub operation_time: NaiveDateTime,
    pub checked_in_at: Option<NaiveDateTime>,
    pub checkin_distance_meters: Option<i32>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<ActivityRegistrationRow> for ActivityRegistration {
    fn from(row: ActivityRegistrationRow) -> Self {
        Self {
            id: row.id,
            activity_id: trim_activity_id(&row.activity_id),
            user_id: row.user_id,
            stand: row.stand as i8,
            registration_count: row.registration_count,
            paid: row.paid as i8,
            operation_time: row.operation_time,
            checked_in_at: row.checked_in_at,
            checkin_distance_meters: row.checkin_distance_meters,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub(super) struct ActivityTeamCheckInConfigRow {
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

impl From<ActivityTeamCheckInConfigRow> for ActivityTeamCheckInConfig {
    fn from(row: ActivityTeamCheckInConfigRow) -> Self {
        Self {
            activity_id: trim_activity_id(&row.activity_id),
            team_id: row.team_id,
            enabled: row.enabled,
            radius_meters: row.radius_meters,
            open_minutes_before: row.open_minutes_before,
            close_minutes_after: row.close_minutes_after,
            updated_by_user_id: row.updated_by_user_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub(super) struct ActivityCheckInRecordRow {
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

impl From<ActivityCheckInRecordRow> for ActivityCheckInRecord {
    fn from(row: ActivityCheckInRecordRow) -> Self {
        Self {
            id: row.id,
            activity_id: trim_activity_id(&row.activity_id),
            team_id: row.team_id,
            user_id: row.user_id,
            latitude: row.latitude,
            longitude: row.longitude,
            distance_meters: row.distance_meters,
            checked_in_at: row.checked_in_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ActivityRow, trim_activity_id};
    use chrono::NaiveDate;

    #[test]
    fn trims_char_padding_from_activity_ids() {
        assert_eq!(trim_activity_id("act-filter-1      "), "act-filter-1");
        assert_eq!(
            trim_activity_id("8202e940-d814-4a3f-9464-e285baf3dc79"),
            "8202e940-d814-4a3f-9464-e285baf3dc79"
        );
    }

    #[test]
    fn converts_padded_activity_row_ids_to_trimmed_domain_ids() {
        let now = NaiveDate::from_ymd_opt(2026, 4, 15)
            .expect("valid date")
            .and_hms_opt(20, 0, 0)
            .expect("valid time");

        let activity = crate::activity::domain::Activity::from(ActivityRow {
            id: "act-filter-1776256129841949000      ".to_string(),
            cover: None,
            start_time: now,
            end_time: now,
            holding_date: now,
            location: "测试球场".to_string(),
            location_latitude: None,
            location_longitude: None,
            name: "测试活动".to_string(),
            opposing: None,
            status: 0,
            description: None,
            home_team_id: None,
            away_team_id: None,
            color: None,
            opposing_color: None,
            players_per_team: None,
            team_capacity_limit: None,
            match_kind: Some("external".to_string()),
            source_activity_id: None,
            team_registration_count: None,
            created_at: now,
            updated_at: now,
        });

        assert_eq!(activity.id, "act-filter-1776256129841949000");
    }
}
