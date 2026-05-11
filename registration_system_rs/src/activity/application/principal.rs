#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivityRole {
    Admin,
    User,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ActivityPrincipal {
    pub id: i64,
    pub role: ActivityRole,
    pub is_super_admin: bool,
}

impl ActivityPrincipal {
    pub fn admin(id: i64, is_super_admin: bool) -> Self {
        Self {
            id,
            role: ActivityRole::Admin,
            is_super_admin,
        }
    }

    pub fn user(id: i64) -> Self {
        Self {
            id,
            role: ActivityRole::User,
            is_super_admin: false,
        }
    }

    pub fn is_admin(self) -> bool {
        matches!(self.role, ActivityRole::Admin)
    }

    pub fn is_user(self) -> bool {
        matches!(self.role, ActivityRole::User)
    }
}
