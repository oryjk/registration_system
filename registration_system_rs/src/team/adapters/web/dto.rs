use crate::team::application::{TeamCreditOverview, TeamDetail, TeamDetailForAdmin, TeamSummary};
use crate::team::domain::{
    Team, TeamAdminInfo, TeamCreditTransaction, TeamMember, TeamMemberWithInfo,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTeamRequest {
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub join_password: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct JoinTeamRequest {
    pub team_id: String,
    pub password: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateTeamRequest {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub logo_url: Option<Option<String>>,
    pub captain_id: Option<Option<i64>>,
    pub status: Option<i8>,
    pub join_password: Option<Option<String>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AddTeamMemberRequest {
    pub user_id: i64,
    pub role: Option<String>,
    pub jersey_number: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateTeamMemberRequest {
    pub role: Option<String>,
    pub jersey_number: Option<Option<String>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SubmitActivityReviewRequest {
    pub activity_id: String,
    pub reviewer_team_id: String,
    pub rating: i8,
    pub comment: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TeamMembershipRechargeRequest {
    pub months: i32,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TeamCreditPenaltyRequest {
    pub points: i32,
    pub reason: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub captain_id: Option<i64>,
    pub status: i8,
    pub credit_score: i32,
    pub vip_until: Option<chrono::NaiveDateTime>,
    pub trust_label: String,
    pub is_vip: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamLogoUploadResponse {
    pub logo_url: String,
}

impl From<Team> for TeamDto {
    fn from(value: Team) -> Self {
        let now = chrono::Utc::now().naive_utc();
        let trust_label = value.trust_label_at(now);
        let is_vip = value.is_vip_at(now);
        Self {
            id: value.id,
            name: value.name,
            description: value.description,
            logo_url: value.logo_url,
            captain_id: value.captain_id,
            status: value.status,
            credit_score: value.credit_score,
            vip_until: value.vip_until,
            trust_label,
            is_vip,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamSummaryDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub captain_id: Option<i64>,
    pub status: i8,
    pub member_count: usize,
    pub credit_score: i32,
    pub vip_until: Option<chrono::NaiveDateTime>,
    pub trust_label: String,
    pub is_vip: bool,
}

impl From<TeamSummary> for TeamSummaryDto {
    fn from(value: TeamSummary) -> Self {
        let now = chrono::Utc::now().naive_utc();
        let team = value.team;
        let trust_label = team.trust_label_at(now);
        let is_vip = team.is_vip_at(now);
        Self {
            id: team.id,
            name: team.name,
            description: team.description,
            logo_url: team.logo_url,
            captain_id: team.captain_id,
            status: team.status,
            member_count: value.member_count,
            credit_score: team.credit_score,
            vip_until: team.vip_until,
            trust_label,
            is_vip,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamMemberDto {
    pub user_id: i64,
    pub role: String,
    pub jersey_number: Option<String>,
    pub joined_at: chrono::NaiveDateTime,
    pub status: i8,
}

impl From<TeamMember> for TeamMemberDto {
    fn from(value: TeamMember) -> Self {
        Self {
            user_id: value.user_id,
            role: value.role,
            jersey_number: value.jersey_number,
            joined_at: value.joined_at,
            status: value.status,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamDetailDto {
    pub team: TeamDto,
    pub members: Vec<TeamMemberDto>,
}

impl From<TeamDetail> for TeamDetailDto {
    fn from(value: TeamDetail) -> Self {
        Self {
            team: TeamDto::from(value.team),
            members: value.members.into_iter().map(TeamMemberDto::from).collect(),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamPasswordInfoDto {
    pub team_id: String,
    pub requires_password: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamCreditOverviewDto {
    pub team: TeamDto,
    pub trust_label: String,
    pub is_vip: bool,
}

impl From<TeamCreditOverview> for TeamCreditOverviewDto {
    fn from(value: TeamCreditOverview) -> Self {
        Self {
            team: TeamDto::from(value.team),
            trust_label: value.trust_label,
            is_vip: value.is_vip,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamCreditTransactionDto {
    pub id: i64,
    pub team_id: String,
    pub activity_id: Option<String>,
    pub transaction_type: String,
    pub delta: i32,
    pub score_before: i32,
    pub score_after: i32,
    pub rating: Option<i8>,
    #[schema(value_type = Option<String>)]
    pub amount: Option<Decimal>,
    pub membership_months: Option<i32>,
    pub note: Option<String>,
    pub reviewer_team_id: Option<String>,
    pub created_by_user_id: Option<i64>,
    pub created_by_admin_id: Option<i64>,
    pub created_at: chrono::NaiveDateTime,
}

impl From<TeamCreditTransaction> for TeamCreditTransactionDto {
    fn from(value: TeamCreditTransaction) -> Self {
        Self {
            id: value.id,
            team_id: value.team_id,
            activity_id: value.activity_id,
            transaction_type: value.transaction_type,
            delta: value.delta,
            score_before: value.score_before,
            score_after: value.score_after,
            rating: value.rating,
            amount: value.amount,
            membership_months: value.membership_months,
            note: value.note,
            reviewer_team_id: value.reviewer_team_id,
            created_by_user_id: value.created_by_user_id,
            created_by_admin_id: value.created_by_admin_id,
            created_at: value.created_at,
        }
    }
}

// ─────────────── 管理后台专用 ───────────────

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminCreateTeamRequest {
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub join_password: Option<String>,
    pub captain_id: Option<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamMemberWithInfoDto {
    pub user_id: i64,
    pub role: String,
    pub role_label: String,
    pub jersey_number: Option<String>,
    pub joined_at: chrono::NaiveDateTime,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
}

impl From<TeamMemberWithInfo> for TeamMemberWithInfoDto {
    fn from(v: TeamMemberWithInfo) -> Self {
        let role_label = match v.role.as_str() {
            "captain" => "队长".to_string(),
            "leader" => "领队".to_string(),
            "vice_captain" => "二场队长".to_string(),
            _ => "队员".to_string(),
        };
        Self {
            user_id: v.user_id,
            role: v.role,
            role_label,
            jersey_number: v.jersey_number,
            joined_at: v.joined_at,
            nickname: v.nickname,
            real_name: v.real_name,
            avatar_url: v.avatar_url,
            phone_number: v.phone_number,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamDetailForAdminDto {
    pub team: TeamDto,
    pub members: Vec<TeamMemberWithInfoDto>,
    pub member_count: usize,
    pub assigned_admins: Vec<TeamAdminInfoDto>,
}

impl From<TeamDetailForAdmin> for TeamDetailForAdminDto {
    fn from(v: TeamDetailForAdmin) -> Self {
        let member_count = v.members.len();
        Self {
            team: TeamDto::from(v.team),
            members: v
                .members
                .into_iter()
                .map(TeamMemberWithInfoDto::from)
                .collect(),
            member_count,
            assigned_admins: v
                .assigned_admins
                .into_iter()
                .map(TeamAdminInfoDto::from)
                .collect(),
        }
    }
}

// ─── 球队管理员分配 ───

#[derive(Debug, Serialize, ToSchema)]
pub struct TeamAdminInfoDto {
    pub admin_id: i64,
    pub username: String,
    pub nickname: String,
}

impl From<TeamAdminInfo> for TeamAdminInfoDto {
    fn from(v: TeamAdminInfo) -> Self {
        Self {
            admin_id: v.admin_id,
            username: v.username,
            nickname: v.nickname,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AssignAdminRequest {
    pub admin_id: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct BatchRemoveMembersRequest {
    pub user_ids: Vec<i64>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct BatchUpdateMemberStatusRequest {
    pub user_ids: Vec<i64>,
    pub status: i8,
}
