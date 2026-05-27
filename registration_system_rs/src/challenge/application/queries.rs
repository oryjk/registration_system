use crate::challenge::domain::{ChallengeKind, ChallengeStatus};
use chrono::NaiveDateTime;

#[derive(Debug, Clone, Copy)]
pub struct TeamChallengeListRequest<'a> {
    pub team_id: i64,
    pub keyword: Option<&'a str>,
    pub status: Option<ChallengeStatus>,
    pub kind: Option<ChallengeKind>,
    pub include_closed: bool,
    pub limit: i64,
    pub sort: &'a str,
    pub starts_after: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Copy)]
pub struct PublicChallengeListQuery<'a> {
    pub viewer_user_id: Option<i64>,
    pub keyword: Option<&'a str>,
    pub status: Option<ChallengeStatus>,
    pub kind: Option<ChallengeKind>,
    pub include_closed: bool,
    pub limit: i64,
    pub sort: &'a str,
    pub starts_after: Option<NaiveDateTime>,
}

#[derive(Debug, Clone)]
pub struct AdminChallengeListQuery {
    pub team_id: Option<i64>,
    pub keyword: Option<String>,
    pub status: Option<ChallengeStatus>,
    pub kind: Option<ChallengeKind>,
    pub include_closed: bool,
    pub limit: i64,
    pub sort: String,
    pub starts_after: Option<NaiveDateTime>,
}
