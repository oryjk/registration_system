use crate::challenge::domain::{ChallengeKind, ChallengePaymentMode};
use rust_decimal::Decimal;

#[derive(Debug, Clone)]
pub struct CreateChallengeCommand {
    pub kind: ChallengeKind,
    pub payment_mode: ChallengePaymentMode,
    pub host_team_id: Option<i64>,
    pub host_user_id: Option<i64>,
    pub title: String,
    pub holding_date: chrono::NaiveDateTime,
    pub start_time: chrono::NaiveDateTime,
    pub end_time: chrono::NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub players_per_team: i32,
    pub min_players: Option<i32>,
    pub max_players: Option<i32>,
    pub fee_per_person: Option<Decimal>,
    pub note: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AcceptChallengeCommand {
    pub guest_team_id: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct UpdateChallengeCommand {
    pub title: String,
    pub holding_date: chrono::NaiveDateTime,
    pub start_time: chrono::NaiveDateTime,
    pub end_time: chrono::NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub players_per_team: i32,
    pub min_players: Option<i32>,
    pub max_players: Option<i32>,
    pub fee_per_person: Option<Decimal>,
    pub note: Option<String>,
}
