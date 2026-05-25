#[derive(Debug, Default, Clone)]
pub struct UpdateUserCommand<'a> {
    pub nickname: Option<&'a str>,
    pub real_name: Option<&'a str>,
    pub avatar_url: Option<&'a str>,
    pub is_manager: Option<bool>,
    pub is_venue: Option<bool>,
    pub status: Option<i8>,
    pub leave_start_time: Option<Option<chrono::NaiveDateTime>>,
    pub leave_end_time: Option<Option<chrono::NaiveDateTime>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoleUserKind {
    Captain,
    Venue,
}

#[derive(Debug, Clone)]
pub struct CreateRoleUserCommand {
    pub role: RoleUserKind,
    pub username: String,
    pub password: String,
    pub real_name: String,
    pub nickname: Option<String>,
    pub phone_number: Option<String>,
    pub team_id: Option<i64>,
}
