use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;

pub fn ensure_user(actor: &ActorContext) -> Result<(), AppError> {
    if actor.actor_kind != ActorKind::User {
        return Err(AppError::Forbidden);
    }
    Ok(())
}
