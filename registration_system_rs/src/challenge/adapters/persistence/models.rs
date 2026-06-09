use crate::activity::domain::Activity;
use crate::challenge::domain::{
    Challenge, ChallengeIndividualParticipant, ChallengeKind, ChallengePaymentMode,
    ChallengeStatus, ChallengeSummary,
};
use chrono::NaiveDateTime;
use rust_decimal::Decimal;
use sqlx::FromRow;

#[derive(Debug, FromRow)]
pub struct ChallengeRow {
    id: String,
    title: String,
    pub(super) kind: String,
    payment_mode: String,
    host_team_id: Option<i64>,
    host_user_id: i64,
    guest_team_id: Option<i64>,
    accepted_by_user_id: Option<i64>,
    activity_id: Option<String>,
    holding_date: NaiveDateTime,
    start_time: NaiveDateTime,
    end_time: NaiveDateTime,
    location: String,
    location_latitude: Option<f64>,
    location_longitude: Option<f64>,
    pub(super) players_per_team: i32,
    pub(super) min_players: Option<i32>,
    pub(super) max_players: Option<i32>,
    fee_per_person: Option<Decimal>,
    note: Option<String>,
    pub(super) status: String,
    accepted_at: Option<NaiveDateTime>,
    cancelled_at: Option<NaiveDateTime>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

impl From<ChallengeRow> for Challenge {
    fn from(row: ChallengeRow) -> Self {
        Self {
            id: row.id,
            title: row.title,
            kind: ChallengeKind::from_db_str(&row.kind),
            payment_mode: ChallengePaymentMode::from_db_str(&row.payment_mode),
            host_team_id: row.host_team_id,
            host_user_id: row.host_user_id,
            guest_team_id: row.guest_team_id,
            accepted_by_user_id: row.accepted_by_user_id,
            activity_id: row.activity_id,
            holding_date: row.holding_date,
            start_time: row.start_time,
            end_time: row.end_time,
            location: row.location,
            location_latitude: row.location_latitude,
            location_longitude: row.location_longitude,
            players_per_team: row.players_per_team,
            min_players: row.min_players,
            max_players: row.max_players,
            fee_per_person: row.fee_per_person,
            note: row.note,
            status: ChallengeStatus::from_db_str(&row.status),
            accepted_at: row.accepted_at,
            cancelled_at: row.cancelled_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct ChallengeSummaryRow {
    id: String,
    title: String,
    kind: String,
    payment_mode: String,
    host_team_id: Option<i64>,
    host_user_id: i64,
    guest_team_id: Option<i64>,
    accepted_by_user_id: Option<i64>,
    activity_id: Option<String>,
    holding_date: NaiveDateTime,
    start_time: NaiveDateTime,
    end_time: NaiveDateTime,
    location: String,
    location_latitude: Option<f64>,
    location_longitude: Option<f64>,
    players_per_team: i32,
    min_players: Option<i32>,
    max_players: Option<i32>,
    fee_per_person: Option<Decimal>,
    note: Option<String>,
    status: String,
    accepted_at: Option<NaiveDateTime>,
    cancelled_at: Option<NaiveDateTime>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    host_team_name: String,
    host_team_credit_score: i32,
    host_team_trust_label: String,
    guest_team_name: Option<String>,
    guest_team_credit_score: Option<i32>,
    guest_team_trust_label: Option<String>,
    current_team_relation: Option<String>,
    accepted_count: i32,
    current_user_joined: bool,
    can_accept: bool,
}

impl From<ChallengeSummaryRow> for ChallengeSummary {
    fn from(row: ChallengeSummaryRow) -> Self {
        Self {
            challenge: Challenge {
                id: row.id,
                title: row.title,
                kind: ChallengeKind::from_db_str(&row.kind),
                payment_mode: ChallengePaymentMode::from_db_str(&row.payment_mode),
                host_team_id: row.host_team_id,
                host_user_id: row.host_user_id,
                guest_team_id: row.guest_team_id,
                accepted_by_user_id: row.accepted_by_user_id,
                activity_id: row.activity_id,
                holding_date: row.holding_date,
                start_time: row.start_time,
                end_time: row.end_time,
                location: row.location,
                location_latitude: row.location_latitude,
                location_longitude: row.location_longitude,
                players_per_team: row.players_per_team,
                min_players: row.min_players,
                max_players: row.max_players,
                fee_per_person: row.fee_per_person,
                note: row.note,
                status: ChallengeStatus::from_db_str(&row.status),
                accepted_at: row.accepted_at,
                cancelled_at: row.cancelled_at,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            host_team_name: row.host_team_name,
            host_team_credit_score: row.host_team_credit_score,
            host_team_trust_label: row.host_team_trust_label,
            guest_team_name: row.guest_team_name,
            guest_team_credit_score: row.guest_team_credit_score,
            guest_team_trust_label: row.guest_team_trust_label,
            current_team_relation: row.current_team_relation,
            accepted_count: row.accepted_count,
            current_user_joined: row.current_user_joined,
            can_accept: row.can_accept,
            individual_participant_preview: Vec::new(),
        }
    }
}

#[derive(Debug, FromRow)]
pub struct ActivityRow {
    id: String,
    cover: Option<String>,
    start_time: NaiveDateTime,
    end_time: NaiveDateTime,
    holding_date: NaiveDateTime,
    location: String,
    location_latitude: Option<f64>,
    location_longitude: Option<f64>,
    name: String,
    opposing: Option<String>,
    status: i16,
    description: Option<String>,
    home_team_id: Option<i64>,
    away_team_id: Option<i64>,
    color: Option<String>,
    opposing_color: Option<String>,
    players_per_team: Option<i32>,
    team_capacity_limit: Option<i32>,
    match_kind: Option<String>,
    source_activity_id: Option<String>,
    team_registration_count: Option<i32>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

impl From<ActivityRow> for Activity {
    fn from(row: ActivityRow) -> Self {
        Self {
            id: row.id,
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
            source_activity_id: row.source_activity_id,
            team_registration_count: row.team_registration_count,
            registration_preview: Default::default(),
            team_checkin_configs: vec![],
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct ChallengeIndividualParticipantRow {
    user_id: i64,
    display_name: String,
    avatar_url: Option<String>,
}

impl From<ChallengeIndividualParticipantRow> for ChallengeIndividualParticipant {
    fn from(row: ChallengeIndividualParticipantRow) -> Self {
        Self {
            user_id: row.user_id,
            display_name: row.display_name,
            avatar_url: row.avatar_url,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct ChallengeIndividualParticipantPreviewRow {
    pub(super) challenge_id: String,
    user_id: i64,
    display_name: String,
    avatar_url: Option<String>,
}

impl ChallengeIndividualParticipantPreviewRow {
    pub fn into_participant(self) -> ChallengeIndividualParticipant {
        ChallengeIndividualParticipant {
            user_id: self.user_id,
            display_name: self.display_name,
            avatar_url: self.avatar_url,
        }
    }
}
