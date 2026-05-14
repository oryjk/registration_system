use crate::auth::domain::AdminUser;

#[derive(Debug, Clone)]
pub struct AdminLoginResult {
    pub access_token: String,
    pub admin: AdminUser,
}
