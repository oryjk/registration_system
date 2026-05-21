use crate::user::domain::{
    PlayerListResult, PlayerTeamSummary, PlayerWithTeams, User, UserActivityRecord,
    UserAttendanceRanking, UserAttendanceRecord,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct UserLoginRequest {
    pub open_id: String,
    pub union_id: Option<String>,
    pub username: Option<String>,
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateProfileRequest {
    pub nickname: Option<String>,
    pub real_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_manager: Option<bool>,
    pub is_venue: Option<bool>,
    pub status: Option<i8>,
    pub leave_start_time: Option<Option<chrono::NaiveDateTime>>,
    pub leave_end_time: Option<Option<chrono::NaiveDateTime>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct BindPhoneNumberRequest {
    pub phone_number: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserDto {
    pub id: i64,
    pub open_id: String,
    pub username: String,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
    pub is_manager: bool,
    pub is_venue: bool,
}

impl From<User> for UserDto {
    fn from(value: User) -> Self {
        Self {
            id: value.id,
            open_id: value.open_id,
            username: value.username,
            nickname: value.nickname,
            real_name: value.real_name,
            avatar_url: value.avatar_url,
            phone_number: value.phone_number,
            is_manager: value.is_manager == 1,
            is_venue: value.is_venue == 1,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserLoginResponse {
    pub access_token: String,
    pub token_type: &'static str,
    pub user: UserDto,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TokenVerifyDto {
    pub user_id: i64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserAvatarUploadResponse {
    pub avatar_url: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserActivityRecordDto {
    pub activity_id: String,
    pub user_id: i64,
    pub stand: i8,
    pub registration_count: i32,
    pub operation_time: chrono::NaiveDateTime,
}

impl From<UserActivityRecord> for UserActivityRecordDto {
    fn from(value: UserActivityRecord) -> Self {
        Self {
            activity_id: value.activity_id,
            user_id: value.user_id,
            stand: value.stand,
            registration_count: value.registration_count,
            operation_time: value.operation_time,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserAttendanceRecordDto {
    pub activity_id: String,
    pub activity_name: String,
    pub holding_date: chrono::NaiveDateTime,
    pub location: String,
    pub stand: i8,
    pub registration_count: i32,
    pub operation_time: chrono::NaiveDateTime,
}

impl From<UserAttendanceRecord> for UserAttendanceRecordDto {
    fn from(value: UserAttendanceRecord) -> Self {
        Self {
            activity_id: value.activity_id,
            activity_name: value.activity_name,
            holding_date: value.holding_date,
            location: value.location,
            stand: value.stand,
            registration_count: value.registration_count,
            operation_time: value.operation_time,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserAttendanceRankingDto {
    pub user_id: i64,
    pub user_name: String,
    pub avatar_url: Option<String>,
    pub attended_count: i64,
}

impl From<UserAttendanceRanking> for UserAttendanceRankingDto {
    fn from(value: UserAttendanceRanking) -> Self {
        Self {
            user_id: value.user_id,
            user_name: value.user_name,
            avatar_url: value.avatar_url,
            attended_count: value.attended_count,
        }
    }
}

// ─────────────────── 球员管理（管理后台专用）───────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct PlayerTeamSummaryDto {
    pub team_id: i64,
    pub team_name: String,
    pub role: String,
    pub jersey_number: Option<String>,
}

impl From<PlayerTeamSummary> for PlayerTeamSummaryDto {
    fn from(v: PlayerTeamSummary) -> Self {
        Self {
            team_id: v.team_id,
            team_name: v.team_name,
            role: v.role,
            jersey_number: v.jersey_number,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PlayerDto {
    pub id: i64,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
    pub is_venue: bool,
    pub status: i8,
    pub status_label: String,
    pub create_time: chrono::NaiveDateTime,
    pub latest_login_date: chrono::NaiveDateTime,
    /// 冻结开始时间（status=0 时有值）
    pub freeze_start_time: Option<chrono::NaiveDateTime>,
    /// 冻结结束时间（可选）
    pub freeze_end_time: Option<chrono::NaiveDateTime>,
    pub teams: Vec<PlayerTeamSummaryDto>,
    pub team_count: usize,
}

impl From<PlayerWithTeams> for PlayerDto {
    fn from(v: PlayerWithTeams) -> Self {
        let team_count = v.teams.len();
        let status_label = if v.status == 1 {
            "正常".to_string()
        } else {
            "冻结".to_string()
        };
        Self {
            id: v.id,
            nickname: v.nickname,
            real_name: v.real_name,
            avatar_url: v.avatar_url,
            phone_number: v.phone_number,
            is_venue: v.is_venue == 1,
            status: v.status,
            status_label,
            create_time: v.create_time,
            latest_login_date: v.latest_login_date,
            freeze_start_time: v.leave_start_time,
            freeze_end_time: v.leave_end_time,
            teams: v
                .teams
                .into_iter()
                .map(PlayerTeamSummaryDto::from)
                .collect(),
            team_count,
        }
    }
}

/// 管理员创建球员
#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminCreatePlayerRequest {
    pub real_name: String,
    pub nickname: Option<String>,
    pub phone_number: Option<String>,
    pub is_venue: Option<bool>,
}

/// 管理员更新球员信息（含冻结管理）
#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminUpdatePlayerRequest {
    pub real_name: Option<String>,
    pub nickname: Option<String>,
    pub phone_number: Option<String>,
    pub is_venue: Option<bool>,
    /// None = 不修改；Some(1) = 解冻/正常；Some(0) = 冻结
    pub status: Option<i8>,
    /// 冻结开始时间，status=0 时必须传
    pub freeze_start_time: Option<chrono::NaiveDateTime>,
    /// 冻结结束时间，可选
    pub freeze_end_time: Option<Option<chrono::NaiveDateTime>>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PlayerListDto {
    pub items: Vec<PlayerDto>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

impl PlayerListDto {
    pub fn from_result(result: PlayerListResult, page: i64, page_size: i64) -> Self {
        Self {
            total: result.total,
            page,
            page_size,
            items: result.items.into_iter().map(PlayerDto::from).collect(),
        }
    }
}
