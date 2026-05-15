use chrono::{NaiveDateTime, Utc};

/// repository `update_fields` 使用的部分更新字段（None = 不修改）
#[derive(Debug, Default)]
pub struct UpdateUserFields<'a> {
    pub nickname: Option<&'a str>,
    pub real_name: Option<&'a str>,
    pub avatar_url: Option<&'a str>,
    pub phone_number: Option<&'a str>,
    pub is_manager: Option<bool>,
    pub is_venue: Option<bool>,
    pub status: Option<i8>,
    pub leave_start_time: Option<Option<NaiveDateTime>>,
    pub leave_end_time: Option<Option<NaiveDateTime>>,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct PlayerAdminListQuery<'a> {
    pub keyword: Option<&'a str>,
    pub status: Option<i8>,
    pub has_team: Option<bool>,
    pub page: i64,
    pub page_size: i64,
    pub sort_by: Option<&'a str>,
    pub sort_order: Option<&'a str>,
    pub admin_scope: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct User {
    pub id: i64,
    pub open_id: String,
    pub union_id: Option<String>,
    pub username: String,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
    pub is_manager: i8,
    pub is_venue: i8,
    pub status: i8,
    pub create_time: NaiveDateTime,
    pub latest_login_date: NaiveDateTime,
    pub leave_start_time: Option<NaiveDateTime>,
    pub leave_end_time: Option<NaiveDateTime>,
}

impl User {
    pub fn new(
        open_id: String,
        union_id: Option<String>,
        username: Option<String>,
        nickname: Option<String>,
        avatar_url: Option<String>,
    ) -> Self {
        let now = Utc::now().naive_utc();
        Self {
            id: 0,
            open_id,
            union_id,
            username: username.unwrap_or_default(),
            nickname: nickname.unwrap_or_default(),
            real_name: String::new(),
            avatar_url: avatar_url.unwrap_or_default(),
            phone_number: String::new(),
            is_manager: 0,
            is_venue: 0,
            status: 1,
            create_time: now,
            latest_login_date: now,
            leave_start_time: None,
            leave_end_time: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct UserActivityRecord {
    pub activity_id: String,
    pub user_id: i64,
    pub stand: i8,
    pub registration_count: i32,
    pub operation_time: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct UserAttendanceRecord {
    pub activity_id: String,
    pub activity_name: String,
    pub holding_date: NaiveDateTime,
    pub location: String,
    pub stand: i8,
    pub registration_count: i32,
    pub operation_time: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct UserAttendanceRanking {
    pub user_id: i64,
    pub user_name: String,
    pub avatar_url: Option<String>,
    pub attended_count: i64,
}

/// 球员所在球队摘要（用于管理后台球员列表）
#[derive(Debug, Clone)]
pub struct PlayerTeamSummary {
    pub team_id: String,
    pub team_name: String,
    pub role: String,
    pub jersey_number: Option<String>,
}

/// 球员 + 所有球队归属（用于管理后台球员列表）
#[derive(Debug, Clone)]
pub struct PlayerWithTeams {
    pub id: i64,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
    pub is_venue: i8,
    pub status: i8,
    pub create_time: NaiveDateTime,
    pub latest_login_date: NaiveDateTime,
    pub leave_start_time: Option<NaiveDateTime>,
    pub leave_end_time: Option<NaiveDateTime>,
    pub teams: Vec<PlayerTeamSummary>,
}

/// 球员列表分页结果
#[derive(Debug, Clone)]
pub struct PlayerListResult {
    pub items: Vec<PlayerWithTeams>,
    pub total: i64,
}
