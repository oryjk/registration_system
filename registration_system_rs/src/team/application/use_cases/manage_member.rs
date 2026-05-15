use crate::team::application::TeamApplicationError;
use crate::team::application::commands::{AddTeamMemberCommand, UpdateTeamMemberCommand};
use crate::team::application::permission::TeamPermissionChecker;
use crate::team::application::principal::TeamPrincipal;
use crate::team::domain::DomainError;
use crate::team::ports::{TeamCommandRepository, TeamQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct ManageMemberUseCase {
    query_repository: Arc<dyn TeamQueryRepository>,
    command_repository: Arc<dyn TeamCommandRepository>,
    permission_checker: TeamPermissionChecker,
}

impl ManageMemberUseCase {
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

    pub async fn add_member(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: AddTeamMemberCommand,
    ) -> Result<(), TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        self.permission_checker
            .ensure_team_manager(principal, &team)
            .await?;

        if self
            .query_repository
            .is_member(team_id, command.user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查成员失败: {error}")))?
        {
            return Err(TeamApplicationError::Conflict(
                "该用户已经是球队成员".to_string(),
            ));
        }

        match self
            .query_repository
            .get_member_status(team_id, command.user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查成员状态失败: {error}")))?
        {
            Some(0) => {
                self.command_repository
                    .reactivate_member(
                        team_id,
                        command.user_id,
                        command.role.as_deref().unwrap_or("member"),
                        command.jersey_number.as_deref(),
                        command.is_member.unwrap_or(false),
                    )
                    .await
                    .map_err(|error| {
                        TeamApplicationError::internal(format!("重新激活成员失败: {error}"))
                    })?;
            }
            _ => {
                self.command_repository
                    .add_member(
                        team_id,
                        command.user_id,
                        command.role.as_deref().unwrap_or("member"),
                        command.jersey_number.as_deref(),
                        command.is_member.unwrap_or(false),
                    )
                    .await
                    .map_err(|error| match error {
                        DomainError::AlreadyMember => {
                            TeamApplicationError::Conflict("该用户已经是球队成员".to_string())
                        }
                        other => TeamApplicationError::internal(format!("添加成员失败: {other}")),
                    })?;
            }
        }

        Ok(())
    }

    pub async fn remove_member(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        target_user_id: i64,
    ) -> Result<(), TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        let is_self = principal.is_user() && principal.id == target_user_id;
        if !is_self {
            self.permission_checker
                .ensure_team_manager(principal, &team)
                .await?;
        }

        if !self
            .query_repository
            .is_member(team_id, target_user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查成员失败: {error}")))?
        {
            return Err(TeamApplicationError::NotFound(
                "该用户不是球队成员".to_string(),
            ));
        }

        self.command_repository
            .remove_member(team_id, target_user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("移除成员失败: {error}")))
    }

    pub async fn batch_remove_members(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        user_ids: &[i64],
    ) -> Result<u64, TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        self.permission_checker
            .ensure_team_manager(principal, &team)
            .await?;
        if user_ids.is_empty() {
            return Ok(0);
        }

        self.command_repository
            .batch_remove_members(team_id, user_ids)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("批量移除成员失败: {error}")))
    }

    pub async fn batch_update_member_status(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        user_ids: &[i64],
        status: i8,
    ) -> Result<u64, TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        self.permission_checker
            .ensure_team_manager(principal, &team)
            .await?;
        if user_ids.is_empty() {
            return Ok(0);
        }
        if !matches!(status, 0 | 1) {
            return Err(TeamApplicationError::Validation(
                "队员状态只能是 0 或 1".to_string(),
            ));
        }

        self.command_repository
            .batch_update_member_status(team_id, user_ids, status)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("批量更新成员状态失败: {error}"))
            })
    }

    pub async fn update_member(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        target_user_id: i64,
        command: UpdateTeamMemberCommand,
    ) -> Result<(), TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        self.permission_checker
            .ensure_team_manager(principal, &team)
            .await?;

        if !self
            .query_repository
            .is_member(team_id, target_user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查成员失败: {error}")))?
        {
            return Err(TeamApplicationError::NotFound(
                "该用户不是球队成员".to_string(),
            ));
        }

        self.command_repository
            .update_member(
                team_id,
                target_user_id,
                command.role.as_deref(),
                command.jersey_number.as_ref().map(|value| value.as_deref()),
                command.is_member,
            )
            .await
            .map_err(|error| TeamApplicationError::internal(format!("更新成员失败: {error}")))
    }
}
