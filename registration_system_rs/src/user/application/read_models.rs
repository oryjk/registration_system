use crate::user::domain::User;

#[derive(Debug, Clone)]
pub struct UserLoginResult {
    pub access_token: String,
    pub user: User,
}
