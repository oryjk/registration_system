use crate::team::application::TeamApplicationError;
use crate::team::application::commands::CreateTeamCommand;
use crate::team::application::principal::TeamPrincipal;
use crate::team::domain::{DEFAULT_TEAM_CREDIT_SCORE, DomainError, Team};
use crate::team::ports::{TeamCommandRepository, TeamQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct CreateTeamUseCase {
    query_repository: Arc<dyn TeamQueryRepository>,
    command_repository: Arc<dyn TeamCommandRepository>,
}

impl CreateTeamUseCase {
    pub fn new(
        query_repository: Arc<dyn TeamQueryRepository>,
        command_repository: Arc<dyn TeamCommandRepository>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
        }
    }

    pub async fn execute_for_user(
        &self,
        principal: &TeamPrincipal,
        command: CreateTeamCommand,
    ) -> Result<Team, TeamApplicationError> {
        if !principal.is_user() {
            return Err(TeamApplicationError::Forbidden);
        }

        self.create(command, Some(principal.id)).await
    }

    pub async fn execute_for_admin(
        &self,
        principal: &TeamPrincipal,
        command: CreateTeamCommand,
        captain_id: Option<i64>,
    ) -> Result<Team, TeamApplicationError> {
        if !principal.is_admin() {
            return Err(TeamApplicationError::Forbidden);
        }

        self.create(command, captain_id).await
    }

    async fn create(
        &self,
        command: CreateTeamCommand,
        captain_id: Option<i64>,
    ) -> Result<Team, TeamApplicationError> {
        if command.name.trim().is_empty() {
            return Err(TeamApplicationError::Validation(
                "球队名称不能为空".to_string(),
            ));
        }

        if self
            .query_repository
            .find_by_name(&command.name)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查球队名称失败: {error}")))?
            .is_some()
        {
            return Err(TeamApplicationError::Conflict("球队名称已存在".to_string()));
        }

        let password_hash = match command.join_password {
            Some(password) if !password.is_empty() => Some(
                bcrypt::hash(password, bcrypt::DEFAULT_COST).map_err(|error| {
                    TeamApplicationError::internal(format!("加密球队密码失败: {error}"))
                })?,
            ),
            _ => None,
        };

        let now = chrono::Utc::now().naive_utc();
        let team = Team {
            id: 0,
            name: command.name,
            description: command.description,
            logo_url: command.logo_url,
            captain_id,
            join_password_hash: password_hash,
            status: 1,
            credit_score: DEFAULT_TEAM_CREDIT_SCORE,
            vip_until: None,
            created_at: now,
            updated_at: now,
        };

        let team = self
            .command_repository
            .create(&team)
            .await
            .map_err(|error| match error {
                DomainError::NameAlreadyExists => {
                    TeamApplicationError::Conflict("球队名称已存在".to_string())
                }
                other => TeamApplicationError::internal(format!("创建球队失败: {other}")),
            })?;

        if let Some(captain_id) = captain_id {
            self.command_repository
                .add_member(team.id, captain_id, "captain", None, false)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("添加队长成员失败: {error}"))
                })?;
        }

        Ok(team)
    }
}
