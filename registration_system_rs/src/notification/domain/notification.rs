use chrono::NaiveDateTime;

#[derive(Debug, Clone)]
pub struct Notification {
    pub id: String,
    pub user_id: i64,
    pub kind: String,
    pub title: String,
    pub content: String,
    pub related_type: Option<String>,
    pub related_id: Option<String>,
    pub read_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
