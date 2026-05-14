use super::error::ActivityApplicationError;
use super::principal::ActivityPrincipal;
use crate::activity::domain::Activity;
use crate::activity::ports::ActivityTeamAccessPort;
use std::sync::Arc;

#[derive(Clone)]
pub struct ActivityPermissionChecker {
    team_access_port: Arc<dyn ActivityTeamAccessPort>,
}

impl ActivityPermissionChecker {
    pub fn new(team_access_port: Arc<dyn ActivityTeamAccessPort>) -> Self {
        Self { team_access_port }
    }

    pub fn ensure_admin(&self, actor: &ActivityPrincipal) -> Result<(), ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        Ok(())
    }

    pub fn ensure_user(&self, actor: &ActivityPrincipal) -> Result<(), ActivityApplicationError> {
        if !actor.is_user() {
            return Err(ActivityApplicationError::Forbidden);
        }
        Ok(())
    }

    pub async fn ensure_team_manager(
        &self,
        actor: &ActivityPrincipal,
        team_id: i64,
    ) -> Result<(), ActivityApplicationError> {
        self.ensure_user(actor)?;

        let role = self
            .team_access_port
            .find_active_member_role(team_id, actor.id)
            .await
            .map_err(ActivityApplicationError::internal)?;

        if !role.as_deref().is_some_and(is_team_manager_role) {
            return Err(ActivityApplicationError::Forbidden);
        }

        Ok(())
    }

    pub async fn ensure_activity_manager_or_admin(
        &self,
        actor: &ActivityPrincipal,
        activity: &Activity,
    ) -> Result<(), ActivityApplicationError> {
        if actor.is_admin() {
            return Ok(());
        }
        if activity.source_activity_id.is_some() {
            return Err(ActivityApplicationError::Forbidden);
        }

        let home_team_id = activity
            .home_team_id
            .ok_or(ActivityApplicationError::Forbidden)?;
        self.ensure_team_manager(actor, home_team_id).await
    }
}

pub(crate) fn is_team_manager_role(role: &str) -> bool {
    matches!(role, "captain" | "leader")
}
