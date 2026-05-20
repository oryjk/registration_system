use crate::activity::domain::Activity;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChallengeStatus {
    Open,
    Matched,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChallengeKind {
    Team,
    Individual,
}

impl ChallengeKind {
    pub fn as_db_str(self) -> &'static str {
        match self {
            Self::Team => "team",
            Self::Individual => "individual",
        }
    }

    pub fn from_db_str(value: &str) -> Self {
        match value {
            "individual" => Self::Individual,
            _ => Self::Team,
        }
    }
}

impl ChallengeStatus {
    pub fn as_db_str(self) -> &'static str {
        match self {
            Self::Open => "open",
            Self::Matched => "matched",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn from_db_str(value: &str) -> Self {
        match value {
            "matched" => Self::Matched,
            "cancelled" => Self::Cancelled,
            _ => Self::Open,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Challenge {
    pub id: String,
    pub title: String,
    pub kind: ChallengeKind,
    pub host_team_id: Option<i64>,
    pub host_user_id: i64,
    pub guest_team_id: Option<i64>,
    pub accepted_by_user_id: Option<i64>,
    pub activity_id: Option<String>,
    pub holding_date: NaiveDateTime,
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub players_per_team: i32,
    pub fee_per_person: Option<Decimal>,
    pub note: Option<String>,
    pub status: ChallengeStatus,
    pub accepted_at: Option<NaiveDateTime>,
    pub cancelled_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl Challenge {
    pub fn signup_capacity(&self) -> i32 {
        match self.kind {
            ChallengeKind::Individual => self.players_per_team * 2,
            ChallengeKind::Team => self.players_per_team,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ChallengeSummary {
    pub challenge: Challenge,
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
    pub individual_participant_preview: Vec<ChallengeIndividualParticipant>,
}

#[derive(Debug, Clone)]
pub struct ChallengeIndividualParticipant {
    pub user_id: i64,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ChallengeDetail {
    pub summary: ChallengeSummary,
    pub activity: Option<Activity>,
    pub individual_participants: Vec<ChallengeIndividualParticipant>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn challenge(kind: ChallengeKind, players_per_team: i32) -> Challenge {
        let now = Utc::now().naive_utc();
        Challenge {
            id: "challenge-a".to_string(),
            title: "测试约队".to_string(),
            kind,
            host_team_id: Some(1),
            host_user_id: 1,
            guest_team_id: None,
            accepted_by_user_id: None,
            activity_id: None,
            holding_date: now,
            start_time: now,
            end_time: now,
            location: "测试球场".to_string(),
            location_latitude: None,
            location_longitude: None,
            players_per_team,
            fee_per_person: None,
            note: None,
            status: ChallengeStatus::Open,
            accepted_at: None,
            cancelled_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn individual_challenge_capacity_uses_both_sides() {
        assert_eq!(
            challenge(ChallengeKind::Individual, 8).signup_capacity(),
            16
        );
        assert_eq!(
            challenge(ChallengeKind::Individual, 5).signup_capacity(),
            10
        );
    }

    #[test]
    fn team_challenge_capacity_uses_opponent_side_only() {
        assert_eq!(challenge(ChallengeKind::Team, 8).signup_capacity(), 8);
        assert_eq!(challenge(ChallengeKind::Team, 5).signup_capacity(), 5);
    }
}
