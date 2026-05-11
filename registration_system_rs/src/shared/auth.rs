use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActorKind {
    Admin,
    User,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ActorContext {
    pub id: i64,
    pub actor_kind: ActorKind,
    pub is_super_admin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64,
    pub actor_kind: ActorKind,
    /// Admin token 专属字段；User token 中为 None
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_super_admin: Option<bool>,
    pub exp: usize,
    pub iat: usize,
    pub iss: String,
}

impl Claims {
    pub fn actor(&self) -> ActorContext {
        ActorContext {
            id: self.sub,
            actor_kind: self.actor_kind,
            is_super_admin: self.is_super_admin.unwrap_or(false),
        }
    }
}
