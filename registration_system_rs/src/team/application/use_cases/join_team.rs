use crate::team::application::TeamApplicationError;
use crate::team::application::permission::TeamPermissionChecker;
use crate::team::application::principal::TeamPrincipal;
use crate::team::ports::{TeamCommandRepository, TeamQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct JoinTeamUseCase {
    query_repository: Arc<dyn TeamQueryRepository>,
    command_repository: Arc<dyn TeamCommandRepository>,
    permission_checker: TeamPermissionChecker,
}

impl JoinTeamUseCase {
    pub fn new(
        query_repository: Arc<dyn TeamQueryRepository>,
        command_repository: Arc<dyn TeamCommandRepository>,
    ) -> Self {
        let permission_checker = TeamPermissionChecker::new(query_repository.clone());
        Self {
            query_repository,
            command_repository,
            permission_checker,
        }
    }

    pub async fn execute(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        password: Option<&str>,
    ) -> Result<(), TeamApplicationError> {
        if !principal.is_user() {
            return Err(TeamApplicationError::Forbidden);
        }

        let team = self.permission_checker.get_team(team_id).await?;

        if team.status != 1 {
            return Err(TeamApplicationError::Validation(
                "球队已解散或不可加入".to_string(),
            ));
        }

        if self
            .query_repository
            .is_member(team_id, principal.id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("检查球队成员关系失败: {error}"))
            })?
        {
            return Err(TeamApplicationError::Conflict(
                "您已经是该球队成员".to_string(),
            ));
        }

        if let Some(hash) = team.join_password_hash {
            let raw_password = password.unwrap_or_default();
            let password_ok = bcrypt::verify(raw_password, &hash).map_err(|error| {
                TeamApplicationError::internal(format!("验证球队密码失败: {error}"))
            })?;
            if !password_ok {
                return Err(TeamApplicationError::Validation("加入密码错误".to_string()));
            }
        }

        let member_status = self
            .query_repository
            .get_member_status(team_id, principal.id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("检查成员状态失败: {error}"))
            })?;

        match member_status {
            Some(0) => {
                self.command_repository
                    .reactivate_member(team_id, principal.id, "member", None)
                    .await
                    .map_err(|error| {
                        TeamApplicationError::internal(format!("重新加入球队失败: {error}"))
                    })?;
            }
            _ => {
                self.command_repository
                    .add_member(team_id, principal.id, "member", None)
                    .await
                    .map_err(|error| {
                        TeamApplicationError::internal(format!("加入球队失败: {error}"))
                    })?;
            }
        }

        Ok(())
    }
}
