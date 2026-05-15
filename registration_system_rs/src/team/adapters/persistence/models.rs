use crate::team::domain::{
    ActivityTeamReview, Team, TeamAdminInfo, TeamAttendanceRankingItem, TeamCreditTransaction,
    TeamMember, TeamMemberAttendanceRecord, TeamMemberWithInfo,
};
use chrono::NaiveDateTime;
use rust_decimal::Decimal;
use sqlx::FromRow;

#[derive(Debug, FromRow)]
pub struct TeamRow {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub captain_id: Option<i64>,
    pub join_password_hash: Option<String>,
    pub status: i16,
    pub credit_score: i32,
    pub vip_until: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<TeamRow> for Team {
    fn from(row: TeamRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            description: row.description,
            logo_url: row.logo_url,
            captain_id: row.captain_id,
            join_password_hash: row.join_password_hash,
            status: row.status as i8,
            credit_score: row.credit_score,
            vip_until: row.vip_until,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct TeamMemberRow {
    pub id: i64,
    pub team_id: i64,
    pub user_id: i64,
    pub role: String,
    pub jersey_number: Option<String>,
    pub is_member: bool,
    pub joined_at: NaiveDateTime,
    pub status: i16,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<TeamMemberRow> for TeamMember {
    fn from(row: TeamMemberRow) -> Self {
        Self {
            id: row.id,
            team_id: row.team_id,
            user_id: row.user_id,
            role: row.role,
            jersey_number: row.jersey_number,
            is_member: row.is_member,
            joined_at: row.joined_at,
            status: row.status as i8,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct TeamCreditTransactionRow {
    pub id: i64,
    pub team_id: i64,
    pub activity_id: Option<String>,
    pub transaction_type: String,
    pub delta: i32,
    pub score_before: i32,
    pub score_after: i32,
    pub rating: Option<i16>,
    pub amount: Option<Decimal>,
    pub membership_months: Option<i32>,
    pub note: Option<String>,
    pub reviewer_team_id: Option<i64>,
    pub created_by_user_id: Option<i64>,
    pub created_by_admin_id: Option<i64>,
    pub created_at: NaiveDateTime,
}

impl From<TeamCreditTransactionRow> for TeamCreditTransaction {
    fn from(row: TeamCreditTransactionRow) -> Self {
        Self {
            id: row.id,
            team_id: row.team_id,
            activity_id: row.activity_id,
            transaction_type: row.transaction_type,
            delta: row.delta,
            score_before: row.score_before,
            score_after: row.score_after,
            rating: row.rating.map(|value| value as i8),
            amount: row.amount,
            membership_months: row.membership_months,
            note: row.note,
            reviewer_team_id: row.reviewer_team_id,
            created_by_user_id: row.created_by_user_id,
            created_by_admin_id: row.created_by_admin_id,
            created_at: row.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct ActivityTeamReviewRow {
    pub id: i64,
    pub activity_id: String,
    pub reviewer_team_id: i64,
    pub reviewer_user_id: i64,
    pub reviewee_team_id: i64,
    pub rating: i16,
    pub credit_delta: i32,
    pub comment: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<ActivityTeamReviewRow> for ActivityTeamReview {
    fn from(row: ActivityTeamReviewRow) -> Self {
        Self {
            id: row.id,
            activity_id: row.activity_id,
            reviewer_team_id: row.reviewer_team_id,
            reviewer_user_id: row.reviewer_user_id,
            reviewee_team_id: row.reviewee_team_id,
            rating: row.rating as i8,
            credit_delta: row.credit_delta,
            comment: row.comment,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct TeamMemberAttendanceRecordRow {
    pub activity_id: String,
    pub activity_name: String,
    pub holding_date: NaiveDateTime,
    pub location: String,
    pub stand: i16,
    pub registration_count: i32,
    pub operation_time: Option<NaiveDateTime>,
    pub registered: bool,
}

impl From<TeamMemberAttendanceRecordRow> for TeamMemberAttendanceRecord {
    fn from(row: TeamMemberAttendanceRecordRow) -> Self {
        Self {
            activity_id: row.activity_id,
            activity_name: row.activity_name,
            holding_date: row.holding_date,
            location: row.location,
            stand: row.stand as i8,
            registration_count: row.registration_count,
            operation_time: row.operation_time,
            registered: row.registered,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct TeamAttendanceRankingRow {
    pub user_id: i64,
    pub user_name: String,
    pub avatar_url: Option<String>,
    pub total_count: i64,
    pub attended_count: i64,
    pub leave_count: i64,
    pub late_count: i64,
    pub unregistered_count: i64,
}

impl From<TeamAttendanceRankingRow> for TeamAttendanceRankingItem {
    fn from(row: TeamAttendanceRankingRow) -> Self {
        Self {
            user_id: row.user_id,
            user_name: row.user_name,
            avatar_url: row.avatar_url,
            total_count: row.total_count,
            attended_count: row.attended_count,
            leave_count: row.leave_count,
            late_count: row.late_count,
            unregistered_count: row.unregistered_count,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct TeamMemberWithInfoRow {
    pub user_id: i64,
    pub role: String,
    pub jersey_number: Option<String>,
    pub is_member: bool,
    pub joined_at: NaiveDateTime,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
}

impl From<TeamMemberWithInfoRow> for TeamMemberWithInfo {
    fn from(row: TeamMemberWithInfoRow) -> Self {
        Self {
            user_id: row.user_id,
            role: row.role,
            jersey_number: row.jersey_number,
            is_member: row.is_member,
            joined_at: row.joined_at,
            nickname: row.nickname,
            real_name: row.real_name,
            avatar_url: row.avatar_url,
            phone_number: row.phone_number,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct TeamAdminInfoRow {
    pub admin_id: i64,
    pub username: String,
    pub nickname: String,
}

impl From<TeamAdminInfoRow> for TeamAdminInfo {
    fn from(row: TeamAdminInfoRow) -> Self {
        Self {
            admin_id: row.admin_id,
            username: row.username,
            nickname: row.nickname,
        }
    }
}
