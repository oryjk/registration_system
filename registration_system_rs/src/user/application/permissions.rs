use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;

pub fn ensure_admin(actor: &ActorContext) -> Result<(), AppError> {
    if actor.actor_kind != ActorKind::Admin {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

pub fn ensure_user(actor: &ActorContext) -> Result<(), AppError> {
    if actor.actor_kind != ActorKind::User {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

pub fn ensure_admin_or_self(actor: &ActorContext, target_user_id: i64) -> Result<(), AppError> {
    if actor.actor_kind != ActorKind::Admin && actor.id != target_user_id {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

pub fn player_admin_scope(actor: &ActorContext) -> Result<Option<i64>, AppError> {
    ensure_admin(actor)?;
    Ok(if actor.is_super_admin {
        None
    } else {
        Some(actor.id)
    })
}
