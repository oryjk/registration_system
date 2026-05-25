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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChallengePaymentMode {
    Prepaid,
    Postpaid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndividualAcceptancePaymentStatus {
    Unpaid,
    Paid,
    Cancelled,
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

impl ChallengePaymentMode {
    pub fn as_db_str(self) -> &'static str {
        match self {
            Self::Prepaid => "prepaid",
            Self::Postpaid => "postpaid",
        }
    }

    pub fn from_db_str(value: &str) -> Self {
        match value {
            "prepaid" => Self::Prepaid,
            _ => Self::Postpaid,
        }
    }
}

impl IndividualAcceptancePaymentStatus {
    pub fn as_db_str(self) -> &'static str {
        match self {
            Self::Unpaid => "unpaid",
            Self::Paid => "paid",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn from_db_str(value: &str) -> Self {
        match value {
            "paid" => Self::Paid,
            "cancelled" => Self::Cancelled,
            _ => Self::Unpaid,
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
    pub payment_mode: ChallengePaymentMode,
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
    pub min_players: Option<i32>,
    pub max_players: Option<i32>,
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
        self.max_signup_players()
    }

    pub fn min_signup_players(&self) -> i32 {
        match self.kind {
            ChallengeKind::Individual => self.min_players.unwrap_or(self.players_per_team * 2),
            ChallengeKind::Team => self.players_per_team,
        }
    }

    pub fn max_signup_players(&self) -> i32 {
        match self.kind {
            ChallengeKind::Individual => self.max_players.unwrap_or(self.players_per_team * 2 + 4),
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
pub struct CurrentUserIndividualAcceptance {
    pub payment_status: IndividualAcceptancePaymentStatus,
    pub payment_deadline_at: Option<NaiveDateTime>,
    pub payment_order_no: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ChallengeDetail {
    pub summary: ChallengeSummary,
    pub activity: Option<Activity>,
    pub individual_participants: Vec<ChallengeIndividualParticipant>,
    pub current_user_acceptance: Option<CurrentUserIndividualAcceptance>,
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
            payment_mode: ChallengePaymentMode::Postpaid,
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
            min_players: None,
            max_players: None,
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
    fn individual_challenge_defaults_min_players_to_both_sides() {
        assert_eq!(
            challenge(ChallengeKind::Individual, 8).min_signup_players(),
            16
        );
        assert_eq!(
            challenge(ChallengeKind::Individual, 5).min_signup_players(),
            10
        );
    }

    #[test]
    fn individual_challenge_defaults_max_players_to_both_sides_plus_buffer() {
        assert_eq!(
            challenge(ChallengeKind::Individual, 8).max_signup_players(),
            20
        );
        assert_eq!(
            challenge(ChallengeKind::Individual, 5).max_signup_players(),
            14
        );
    }

    #[test]
    fn individual_challenge_can_override_signup_limits() {
        let mut challenge = challenge(ChallengeKind::Individual, 8);
        challenge.min_players = Some(10);
        challenge.max_players = Some(14);

        assert_eq!(challenge.min_signup_players(), 10);
        assert_eq!(challenge.max_signup_players(), 14);
    }

    #[test]
    fn team_challenge_capacity_uses_opponent_side_only() {
        assert_eq!(challenge(ChallengeKind::Team, 8).signup_capacity(), 8);
        assert_eq!(challenge(ChallengeKind::Team, 5).signup_capacity(), 5);
        assert_eq!(challenge(ChallengeKind::Team, 8).min_signup_players(), 8);
        assert_eq!(challenge(ChallengeKind::Team, 8).max_signup_players(), 8);
    }
}
