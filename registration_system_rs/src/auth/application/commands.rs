#[derive(Debug, Clone)]
pub struct RegisterAdminCommand<'a> {
    pub username: &'a str,
    pub password: &'a str,
    pub nickname: Option<&'a str>,
    pub is_super_admin: bool,
}
