use super::credit::credit_label;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;

/// repository `update` 使用的部分更新字段（None = 不修改）
#[derive(Debug, Default)]
pub struct UpdateTeamFields<'a> {
    pub name: Option<&'a str>,
    pub description: Option<Option<&'a str>>,
    pub logo_url: Option<Option<&'a str>>,
    pub captain_id: Option<Option<i64>>,
    pub status: Option<i8>,
    pub join_password_hash: Option<Option<&'a str>>,
}

#[derive(Debug, Clone)]
pub struct Team {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub captain_id: Option<i64>,
    pub join_password_hash: Option<String>,
    pub status: i8,
    pub credit_score: i32,
    pub vip_until: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl Team {
    pub fn is_vip_at(&self, now: NaiveDateTime) -> bool {
        self.vip_until.is_some_and(|vip_until| vip_until >= now)
    }

    pub fn trust_label_at(&self, now: NaiveDateTime) -> String {
        credit_label(self.credit_score, self.is_vip_at(now))
    }
}

#[derive(Debug, Clone)]
pub struct TeamMember {
    pub id: i64,
    pub team_id: i64,
    pub user_id: i64,
    pub role: String,
    pub jersey_number: Option<String>,
    pub joined_at: NaiveDateTime,
    pub status: i8,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct TeamMemberAttendanceRecord {
    pub activity_id: String,
    pub activity_name: String,
    pub holding_date: NaiveDateTime,
    pub location: String,
    pub stand: i8,
    pub registration_count: i32,
    pub operation_time: Option<NaiveDateTime>,
    pub registered: bool,
}

#[derive(Debug, Clone)]
pub struct TeamAttendanceRankingItem {
    pub user_id: i64,
    pub user_name: String,
    pub avatar_url: Option<String>,
    pub total_count: i64,
    pub attended_count: i64,
    pub leave_count: i64,
    pub late_count: i64,
    pub unregistered_count: i64,
}

/// 球队后台管理员信息
#[derive(Debug, Clone)]
pub struct TeamAdminInfo {
    pub admin_id: i64,
    pub username: String,
    pub nickname: String,
}

/// 队员 + 球员基本信息（管理后台用）
#[derive(Debug, Clone)]
pub struct TeamMemberWithInfo {
    pub user_id: i64,
    pub role: String,
    pub jersey_number: Option<String>,
    pub joined_at: NaiveDateTime,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
}

#[derive(Debug, Clone)]
pub struct TeamCreditTransaction {
    pub id: i64,
    pub team_id: i64,
    pub activity_id: Option<String>,
    pub transaction_type: String,
    pub delta: i32,
    pub score_before: i32,
    pub score_after: i32,
    pub rating: Option<i8>,
    pub amount: Option<Decimal>,
    pub membership_months: Option<i32>,
    pub note: Option<String>,
    pub reviewer_team_id: Option<i64>,
    pub created_by_user_id: Option<i64>,
    pub created_by_admin_id: Option<i64>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct ActivityTeamReview {
    pub id: i64,
    pub activity_id: String,
    pub reviewer_team_id: i64,
    pub reviewer_user_id: i64,
    pub reviewee_team_id: i64,
    pub rating: i8,
    pub credit_delta: i32,
    pub comment: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
