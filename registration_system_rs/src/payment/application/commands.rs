#[derive(Debug, Clone)]
pub struct CreateTeamMembershipOrderCommand {
    pub team_id: i64,
    pub months: i32,
    pub openid: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CreateChallengePaymentOrderCommand {
    pub challenge_id: String,
    pub openid: Option<String>,
}
