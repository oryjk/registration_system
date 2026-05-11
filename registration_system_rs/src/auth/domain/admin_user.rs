use chrono::NaiveDateTime;

#[derive(Debug, Clone)]
pub struct AdminUser {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub nickname: String,
    pub status: i8,
    pub is_super_admin: i8,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub last_login_time: Option<NaiveDateTime>,
}
