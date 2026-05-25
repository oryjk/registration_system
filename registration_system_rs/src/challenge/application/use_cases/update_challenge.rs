use crate::challenge::application::commands::UpdateChallengeCommand;
use super::create_challenge::validate_signup_limits;
use crate::challenge::domain::{Challenge, ChallengeStatus};
use crate::challenge::ports::{
    ChallengeCommandRepository, ChallengeQueryRepository, UpdateChallengeFields,
};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct UpdateChallengeUseCase {
    query_repository: Arc<dyn ChallengeQueryRepository>,
    command_repository: Arc<dyn ChallengeCommandRepository>,
    team_repository: Arc<dyn TeamQueryRepository>,
}

impl UpdateChallengeUseCase {
    pub fn new(
        query_repository: Arc<dyn ChallengeQueryRepository>,
        command_repository: Arc<dyn ChallengeCommandRepository>,
        team_repository: Arc<dyn TeamQueryRepository>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            team_repository,
        }
    }

    pub async fn execute(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
        command: UpdateChallengeCommand,
    ) -> Result<Challenge, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }
        validate_command(&command)?;

        let challenge = self
            .query_repository
            .find_by_id(challenge_id)
            .await
            .map_err(|error| AppError::internal(format!("查询约队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("约队不存在".to_string()))?;

        if challenge.status != ChallengeStatus::Open {
            return Err(AppError::Conflict("当前约队不可编辑".to_string()));
        }
        validate_signup_limits(
            challenge.kind,
            command.players_per_team,
            command.min_players,
            command.max_players,
        )?;
        self.ensure_admin_can_manage(actor, &challenge).await?;
        let (min_players, max_players) = match challenge.kind {
            crate::challenge::domain::ChallengeKind::Individual => {
                (command.min_players, command.max_players)
            }
            crate::challenge::domain::ChallengeKind::Team => (None, None),
        };

        self.command_repository
            .update(
                challenge_id,
                UpdateChallengeFields {
                    title: command.title.trim(),
                    holding_date: command.holding_date,
                    start_time: command.start_time,
                    end_time: command.end_time,
                    location: command.location.trim(),
                    location_latitude: command.location_latitude,
                    location_longitude: command.location_longitude,
                    players_per_team: command.players_per_team,
                    min_players,
                    max_players,
                    fee_per_person: command.fee_per_person,
                    note: command
                        .note
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty()),
                },
            )
            .await
            .map_err(|error| AppError::internal(format!("更新约队失败: {error}")))
    }

    async fn ensure_admin_can_manage(
        &self,
        actor: &ActorContext,
        challenge: &Challenge,
    ) -> Result<(), AppError> {
        if actor.is_super_admin {
            return Ok(());
        }

        let managed_team_ids = self
            .team_repository
            .list_teams_by_admin(actor.id)
            .await
            .map_err(|error| AppError::internal(format!("查询管理员球队失败: {error}")))?
            .into_iter()
            .map(|team| team.id)
            .collect::<Vec<_>>();

        if challenge
            .host_team_id
            .is_some_and(|team_id| managed_team_ids.contains(&team_id))
            || challenge
                .guest_team_id
                .is_some_and(|team_id| managed_team_ids.contains(&team_id))
        {
            Ok(())
        } else {
            Err(AppError::Forbidden)
        }
    }
}

fn validate_command(command: &UpdateChallengeCommand) -> Result<(), AppError> {
    if command.title.trim().is_empty() {
        return Err(AppError::Validation("约队标题不能为空".to_string()));
    }
    if command.location.trim().is_empty() {
        return Err(AppError::Validation("约队地点不能为空".to_string()));
    }
    if command.players_per_team <= 0 {
        return Err(AppError::Validation("比赛人数必须大于 0".to_string()));
    }
    if command.end_time <= command.start_time {
        return Err(AppError::Validation("结束时间必须晚于开始时间".to_string()));
    }
    Ok(())
}
