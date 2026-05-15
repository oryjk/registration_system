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
