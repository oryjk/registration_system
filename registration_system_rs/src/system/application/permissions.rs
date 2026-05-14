use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;

pub fn ensure_admin(actor: &ActorContext) -> Result<(), AppError> {
    if actor.actor_kind != ActorKind::Admin {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

pub fn ensure_super_admin(actor: &ActorContext) -> Result<(), AppError> {
    ensure_admin(actor)?;
    if !actor.is_super_admin {
        return Err(AppError::Forbidden);
    }
    Ok(())
}
