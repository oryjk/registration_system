use crate::shared::auth::{ActorKind, Claims};
use crate::shared::error::AppError;

pub trait TokenServicePort: Send + Sync {
    fn issue_token(&self, actor_kind: ActorKind, subject_id: i64) -> Result<String, AppError>;
    /// 为管理员颁发 token（携带 is_super_admin 标志）
    fn issue_admin_token(&self, subject_id: i64, is_super_admin: bool) -> Result<String, AppError>;
    fn decode_token(&self, token: &str) -> Result<Claims, AppError>;
}
