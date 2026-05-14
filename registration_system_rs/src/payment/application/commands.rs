#[derive(Debug, Clone)]
pub struct CreateTeamMembershipOrderCommand {
    pub team_id: i64,
    pub months: i32,
    pub openid: Option<String>,
    pub note: Option<String>,
}
