use crate::challenge::application::commands::CreateChallengeCommand;
use crate::challenge::application::notifier::ChallengeNotifier;
use crate::challenge::application::permission::ChallengeTeamAccessChecker;
use crate::challenge::domain::{Challenge, ChallengeStatus};
use crate::challenge::ports::ChallengeCommandRepository;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::user::ports::UserQueryRepository;
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct CreateChallengeUseCase {
    command_repository: Arc<dyn ChallengeCommandRepository>,
    team_access_checker: ChallengeTeamAccessChecker,
    user_repository: Arc<dyn UserQueryRepository>,
    notifier: ChallengeNotifier,
}

impl CreateChallengeUseCase {
    pub fn new(
        command_repository: Arc<dyn ChallengeCommandRepository>,
        team_access_checker: ChallengeTeamAccessChecker,
        user_repository: Arc<dyn UserQueryRepository>,
        notifier: ChallengeNotifier,
    ) -> Self {
        Self {
            command_repository,
            team_access_checker,
            user_repository,
            notifier,
        }
    }

    pub async fn execute(
        &self,
        actor: &ActorContext,
        command: CreateChallengeCommand,
    ) -> Result<Challenge, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }
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

        if let Some(host_team_id) = command.host_team_id {
            self.team_access_checker
                .get_team(host_team_id, "查询主队失败", "主队不存在")
                .await?;

            if !self
                .team_access_checker
                .is_team_manager(host_team_id, actor.id)
                .await?
            {
                return Err(AppError::Forbidden);
            }
        } else {
            let user = self
                .user_repository
                .find_by_id(actor.id)
                .await
                .map_err(|error| AppError::internal(format!("查询用户身份失败: {error}")))?
                .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))?;

            if user.is_venue != 1 {
                return Err(AppError::Forbidden);
            }
        }

        let now = Utc::now().naive_utc();
        let challenge = Challenge {
            id: Uuid::new_v4().to_string(),
            title: command.title.trim().to_string(),
            kind: command.kind,
            host_team_id: command.host_team_id,
            host_user_id: actor.id,
            guest_team_id: None,
            accepted_by_user_id: None,
            activity_id: None,
            holding_date: command.holding_date,
            start_time: command.start_time,
            end_time: command.end_time,
            location: command.location.trim().to_string(),
            location_latitude: command.location_latitude,
            location_longitude: command.location_longitude,
            players_per_team: command.players_per_team,
            fee_per_person: command.fee_per_person,
            note: command
                .note
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty()),
            status: ChallengeStatus::Open,
            accepted_at: None,
            cancelled_at: None,
            created_at: now,
            updated_at: now,
        };

        self.command_repository
            .create(&challenge)
            .await
            .map_err(|error| AppError::internal(format!("创建约队失败: {error}")))?;

        self.notifier.challenge_created(&challenge).await?;

        Ok(challenge)
    }
}
