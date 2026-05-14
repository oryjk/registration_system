use crate::challenge::domain::ChallengeStatus;

#[derive(Debug, Clone, Copy)]
pub struct TeamChallengeListRequest<'a> {
    pub team_id: i64,
    pub keyword: Option<&'a str>,
    pub status: Option<ChallengeStatus>,
    pub include_closed: bool,
    pub limit: i64,
    pub sort: &'a str,
}

#[derive(Debug, Clone)]
pub struct AdminChallengeListQuery {
    pub team_id: Option<i64>,
    pub keyword: Option<String>,
    pub status: Option<ChallengeStatus>,
    pub include_closed: bool,
    pub limit: i64,
    pub sort: String,
}
