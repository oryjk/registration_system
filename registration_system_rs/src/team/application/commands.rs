#[derive(Debug, Clone)]
pub struct CreateTeamCommand {
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub join_password: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UpdateTeamCommand {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub logo_url: Option<Option<String>>,
    pub captain_id: Option<Option<i64>>,
    pub status: Option<i8>,
    pub join_password: Option<Option<String>>,
}

#[derive(Debug, Clone)]
pub struct AddTeamMemberCommand {
    pub user_id: i64,
    pub role: Option<String>,
    pub jersey_number: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UpdateTeamMemberCommand {
    pub role: Option<String>,
    pub jersey_number: Option<Option<String>>,
}

#[derive(Debug, Clone)]
pub struct SubmitActivityReviewCommand {
    pub activity_id: String,
    pub reviewer_team_id: i64,
    pub rating: i8,
    pub comment: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TeamMembershipRechargeCommand {
    pub months: i32,
    pub note: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TeamCreditPenaltyCommand {
    pub points: i32,
    pub reason: String,
}
