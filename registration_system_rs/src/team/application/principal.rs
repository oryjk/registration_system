#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TeamRole {
    Admin,
    User,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TeamPrincipal {
    pub id: i64,
    pub role: TeamRole,
    pub is_super_admin: bool,
}

impl TeamPrincipal {
    pub fn admin(id: i64, is_super_admin: bool) -> Self {
        Self {
            id,
            role: TeamRole::Admin,
            is_super_admin,
        }
    }

    pub fn user(id: i64) -> Self {
        Self {
            id,
            role: TeamRole::User,
            is_super_admin: false,
        }
    }

    pub fn is_admin(self) -> bool {
        matches!(self.role, TeamRole::Admin)
    }

    pub fn is_user(self) -> bool {
        matches!(self.role, TeamRole::User)
    }
}
