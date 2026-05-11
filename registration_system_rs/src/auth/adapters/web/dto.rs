use crate::auth::domain::AdminUser;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminLoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminRegisterRequest {
    pub username: String,
    pub password: String,
    pub nickname: Option<String>,
    pub is_super_admin: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateAdminStatusRequest {
    pub status: i8,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminUserDto {
    pub id: i64,
    pub username: String,
    pub nickname: String,
    pub status: i8,
    pub is_super_admin: bool,
}

impl From<AdminUser> for AdminUserDto {
    fn from(value: AdminUser) -> Self {
        Self {
            id: value.id,
            username: value.username,
            nickname: value.nickname,
            status: value.status,
            is_super_admin: value.is_super_admin == 1,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct VerifyTokenResponse {
    pub admin_id: i64,
    pub admin: AdminUserDto,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminLoginResponse {
    pub access_token: String,
    pub token_type: &'static str,
    pub admin: AdminUserDto,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EmptyData {}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<EmptyData>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EmptyApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<EmptyData>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminUserApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<AdminUserDto>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminUserListApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<Vec<AdminUserDto>>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct VerifyTokenApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<VerifyTokenResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AdminLoginApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<AdminLoginResponse>,
}
