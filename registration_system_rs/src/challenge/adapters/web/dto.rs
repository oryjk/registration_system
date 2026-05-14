use crate::activity::domain::Activity;
use crate::challenge::domain::{
    Challenge, ChallengeDetail, ChallengeIndividualParticipant, ChallengeKind, ChallengeStatus,
    ChallengeSummary,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateChallengeRequest {
    pub kind: String,
    pub host_team_id: i64,
    pub title: String,
    pub holding_date: chrono::NaiveDateTime,
    pub start_time: chrono::NaiveDateTime,
    pub end_time: chrono::NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub players_per_team: i32,
    #[schema(value_type = Option<String>)]
    pub fee_per_person: Option<Decimal>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AcceptChallengeRequest {
    pub guest_team_id: Option<i64>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct ChallengeListQuery {
    pub team_id: Option<i64>,
    pub keyword: Option<String>,
    pub status: Option<String>,
    pub include_closed: Option<bool>,
    pub limit: Option<i64>,
    pub sort: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ChallengeStatusDto {
    Open,
    Matched,
    Cancelled,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ChallengeKindDto {
    Team,
    Individual,
}

impl From<ChallengeKind> for ChallengeKindDto {
    fn from(value: ChallengeKind) -> Self {
        match value {
            ChallengeKind::Team => Self::Team,
            ChallengeKind::Individual => Self::Individual,
        }
    }
}

impl From<ChallengeStatus> for ChallengeStatusDto {
    fn from(value: ChallengeStatus) -> Self {
        match value {
            ChallengeStatus::Open => Self::Open,
            ChallengeStatus::Matched => Self::Matched,
            ChallengeStatus::Cancelled => Self::Cancelled,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChallengeDto {
    pub id: String,
    pub title: String,
    pub kind: ChallengeKindDto,
    pub host_team_id: i64,
    pub host_user_id: i64,
    pub guest_team_id: Option<i64>,
    pub accepted_by_user_id: Option<i64>,
    pub activity_id: Option<String>,
    pub holding_date: chrono::NaiveDateTime,
    pub start_time: chrono::NaiveDateTime,
    pub end_time: chrono::NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub players_per_team: i32,
    #[schema(value_type = Option<String>)]
    pub fee_per_person: Option<Decimal>,
    pub note: Option<String>,
    pub status: ChallengeStatusDto,
    pub accepted_at: Option<chrono::NaiveDateTime>,
    pub cancelled_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

impl From<Challenge> for ChallengeDto {
    fn from(value: Challenge) -> Self {
        Self {
            id: value.id,
            title: value.title,
            kind: ChallengeKindDto::from(value.kind),
            host_team_id: value.host_team_id,
            host_user_id: value.host_user_id,
            guest_team_id: value.guest_team_id,
            accepted_by_user_id: value.accepted_by_user_id,
            activity_id: value.activity_id,
            holding_date: value.holding_date,
            start_time: value.start_time,
            end_time: value.end_time,
            location: value.location,
            location_latitude: value.location_latitude,
            location_longitude: value.location_longitude,
            players_per_team: value.players_per_team,
            fee_per_person: value.fee_per_person,
            note: value.note,
            status: ChallengeStatusDto::from(value.status),
            accepted_at: value.accepted_at,
            cancelled_at: value.cancelled_at,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChallengeSummaryDto {
    pub challenge: ChallengeDto,
    pub host_team_name: String,
    pub host_team_credit_score: i32,
    pub host_team_trust_label: String,
    pub guest_team_name: Option<String>,
    pub guest_team_credit_score: Option<i32>,
    pub guest_team_trust_label: Option<String>,
    pub current_team_relation: Option<String>,
    pub accepted_count: i32,
    pub current_user_joined: bool,
    pub can_accept: bool,
}

impl From<ChallengeSummary> for ChallengeSummaryDto {
    fn from(value: ChallengeSummary) -> Self {
        Self {
            challenge: ChallengeDto::from(value.challenge),
            host_team_name: value.host_team_name,
            host_team_credit_score: value.host_team_credit_score,
            host_team_trust_label: value.host_team_trust_label,
            guest_team_name: value.guest_team_name,
            guest_team_credit_score: value.guest_team_credit_score,
            guest_team_trust_label: value.guest_team_trust_label,
            current_team_relation: value.current_team_relation,
            accepted_count: value.accepted_count,
            current_user_joined: value.current_user_joined,
            can_accept: value.can_accept,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ActivityRefDto {
    pub id: String,
    pub name: String,
    pub holding_date: chrono::NaiveDateTime,
    pub start_time: chrono::NaiveDateTime,
    pub end_time: chrono::NaiveDateTime,
    pub location: String,
    pub home_team_id: Option<i64>,
    pub away_team_id: Option<i64>,
    pub players_per_team: Option<i32>,
}

impl From<Activity> for ActivityRefDto {
    fn from(value: Activity) -> Self {
        Self {
            id: value.id,
            name: value.name,
            holding_date: value.holding_date,
            start_time: value.start_time,
            end_time: value.end_time,
            location: value.location,
            home_team_id: value.home_team_id,
            away_team_id: value.away_team_id,
            players_per_team: value.players_per_team,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChallengeDetailDto {
    pub summary: ChallengeSummaryDto,
    pub activity: Option<ActivityRefDto>,
    pub individual_participants: Vec<ChallengeIndividualParticipantDto>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChallengeIndividualParticipantDto {
    pub user_id: i64,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

impl From<ChallengeIndividualParticipant> for ChallengeIndividualParticipantDto {
    fn from(value: ChallengeIndividualParticipant) -> Self {
        Self {
            user_id: value.user_id,
            display_name: value.display_name,
            avatar_url: value.avatar_url,
        }
    }
}

impl From<ChallengeDetail> for ChallengeDetailDto {
    fn from(value: ChallengeDetail) -> Self {
        Self {
            summary: ChallengeSummaryDto::from(value.summary),
            activity: value.activity.map(ActivityRefDto::from),
            individual_participants: value
                .individual_participants
                .into_iter()
                .map(ChallengeIndividualParticipantDto::from)
                .collect(),
        }
    }
}
