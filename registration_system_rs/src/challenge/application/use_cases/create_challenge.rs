use crate::challenge::application::commands::CreateChallengeCommand;
use crate::challenge::application::notifier::ChallengeNotifier;
use crate::challenge::application::permission::ChallengeTeamAccessChecker;
use crate::challenge::domain::{Challenge, ChallengeKind, ChallengeStatus};
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

        let host_user_id = match actor.actor_kind {
            ActorKind::User => self.resolve_user_host(actor, &command).await?,
            ActorKind::Admin => self.resolve_admin_host(actor, &command).await?,
        };

        let now = Utc::now().naive_utc();
        let challenge = Challenge {
            id: Uuid::new_v4().to_string(),
            title: command.title.trim().to_string(),
            kind: command.kind,
            host_team_id: command.host_team_id,
            host_user_id,
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

    async fn resolve_user_host(
        &self,
        actor: &ActorContext,
        command: &CreateChallengeCommand,
    ) -> Result<i64, AppError> {
        if command
            .host_user_id
            .is_some_and(|host_user_id| host_user_id != actor.id)
        {
            return Err(AppError::Forbidden);
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
            self.ensure_venue_user(actor.id).await?;
        }

        Ok(actor.id)
    }

    async fn resolve_admin_host(
        &self,
        actor: &ActorContext,
        command: &CreateChallengeCommand,
    ) -> Result<i64, AppError> {
        if !actor.is_super_admin {
            return Err(AppError::Forbidden);
        }
        if command.host_team_id.is_some() {
            return Err(AppError::Validation(
                "后台创建散人报名不支持选择球队主体".to_string(),
            ));
        }
        if command.kind != ChallengeKind::Individual {
            return Err(AppError::Validation("后台创建仅支持散人报名".to_string()));
        }
        let host_user_id = command
            .host_user_id
            .ok_or_else(|| AppError::Validation("后台创建需要指定发布用户".to_string()))?;
        self.ensure_venue_user(host_user_id).await?;
        Ok(host_user_id)
    }

    async fn ensure_venue_user(&self, user_id: i64) -> Result<(), AppError> {
        let user = self
            .user_repository
            .find_by_id(user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户身份失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("用户不存在".to_string()))?;

        if user.is_venue == 1 {
            Ok(())
        } else {
            Err(AppError::Forbidden)
        }
    }
}
