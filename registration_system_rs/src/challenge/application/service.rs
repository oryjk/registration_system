use crate::activity::domain::Activity;
use crate::challenge::domain::{
    Challenge, ChallengeDetail, ChallengeKind, ChallengeStatus, ChallengeSummary,
};
use crate::challenge::ports::{
    AdminChallengeRepositoryQuery, ChallengeRepository, TeamChallengeListQuery,
};
use crate::notification::application::NotificationService;
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::team::ports::TeamRepository;
use chrono::Utc;
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct CreateChallengeCommand {
    pub kind: ChallengeKind,
    pub host_team_id: String,
    pub title: String,
    pub holding_date: chrono::NaiveDateTime,
    pub start_time: chrono::NaiveDateTime,
    pub end_time: chrono::NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub players_per_team: i32,
    pub fee_per_person: Option<Decimal>,
    pub note: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AcceptChallengeCommand {
    pub guest_team_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AdminChallengeListQuery {
    pub team_id: Option<String>,
    pub keyword: Option<String>,
    pub status: Option<ChallengeStatus>,
    pub include_closed: bool,
    pub limit: i64,
    pub sort: String,
}

#[derive(Clone)]
pub struct ChallengeService {
    repository: Arc<dyn ChallengeRepository>,
    team_repository: Arc<dyn TeamRepository>,
    notification_service: Arc<NotificationService>,
}

impl ChallengeService {
    pub fn new(
        repository: Arc<dyn ChallengeRepository>,
        team_repository: Arc<dyn TeamRepository>,
        notification_service: Arc<NotificationService>,
    ) -> Self {
        Self {
            repository,
            team_repository,
            notification_service,
        }
    }

    async fn notify_challenge_created(&self, challenge: &Challenge) -> Result<(), AppError> {
        self.notification_service
            .send_to_users(
                &[challenge.host_user_id],
                "challenge_created",
                "约队已发布",
                &format!(
                    "你发布的“{}”已进入约队大厅，等待其他球队接约。",
                    challenge.title
                ),
                Some("challenge"),
                Some(&challenge.id),
            )
            .await?;
        Ok(())
    }

    async fn notify_challenge_cancelled(&self, challenge: &Challenge) -> Result<(), AppError> {
        self.notification_service
            .send_to_users(
                &[challenge.host_user_id],
                "challenge_cancelled",
                "约队已取消",
                &format!("你发布的“{}”已取消，不再继续匹配。", challenge.title),
                Some("challenge"),
                Some(&challenge.id),
            )
            .await?;
        Ok(())
    }

    async fn is_team_manager(&self, team_id: &str, user_id: i64) -> Result<bool, AppError> {
        let team = self
            .team_repository
            .find_by_id(team_id)
            .await
            .map_err(|error| AppError::internal(format!("查询球队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("球队不存在".to_string()))?;

        if team.captain_id == Some(user_id) {
            return Ok(true);
        }

        let members = self
            .team_repository
            .list_members(team_id)
            .await
            .map_err(|error| AppError::internal(format!("查询球队成员失败: {error}")))?;

        Ok(members.into_iter().any(|member| {
            member.status == 1
                && member.user_id == user_id
                && matches!(member.role.as_str(), "captain" | "leader")
        }))
    }

    pub async fn create_challenge(
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

        let _host_team = self
            .team_repository
            .find_by_id(&command.host_team_id)
            .await
            .map_err(|error| AppError::internal(format!("查询主队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("主队不存在".to_string()))?;

        if !self
            .is_team_manager(&command.host_team_id, actor.id)
            .await?
        {
            return Err(AppError::Forbidden);
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

        self.repository
            .create(&challenge)
            .await
            .map_err(|error| AppError::internal(format!("创建约队失败: {error}")))?;

        self.notify_challenge_created(&challenge).await?;

        Ok(challenge)
    }

    pub async fn accept_challenge(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
        command: AcceptChallengeCommand,
    ) -> Result<Challenge, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        let challenge = self
            .repository
            .find_by_id(challenge_id)
            .await
            .map_err(|error| AppError::internal(format!("查询约队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("约队不存在".to_string()))?;

        if challenge.status != ChallengeStatus::Open {
            return Err(AppError::Conflict("该约队当前不可接".to_string()));
        }
        match challenge.kind {
            ChallengeKind::Team => {
                self.accept_team_challenge(actor, challenge_id, challenge, command)
                    .await
            }
            ChallengeKind::Individual => {
                self.accept_individual_challenge(actor, challenge_id, challenge)
                    .await
            }
        }
    }

    pub async fn cancel_challenge(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
    ) -> Result<Challenge, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        let challenge = self
            .repository
            .find_by_id(challenge_id)
            .await
            .map_err(|error| AppError::internal(format!("查询约队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("约队不存在".to_string()))?;

        if !self
            .is_team_manager(&challenge.host_team_id, actor.id)
            .await?
        {
            return Err(AppError::Forbidden);
        }
        if challenge.status != ChallengeStatus::Open {
            return Err(AppError::Conflict("当前约队不可取消".to_string()));
        }

        let challenge = self
            .repository
            .cancel(challenge_id, actor.id)
            .await
            .map_err(|error| AppError::internal(format!("取消约队失败: {error}")))?;

        self.notify_challenge_cancelled(&challenge).await?;

        Ok(challenge)
    }

    pub async fn list_for_team(
        &self,
        actor: &ActorContext,
        team_id: &str,
        keyword: Option<&str>,
        status: Option<ChallengeStatus>,
        include_closed: bool,
        limit: i64,
        sort: &str,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        let can_manage_team = self.is_team_manager(team_id, actor.id).await?;
        let mut items = self
            .repository
            .list_for_team(TeamChallengeListQuery {
                team_id,
                user_id: actor.id,
                keyword,
                status,
                include_closed,
                limit,
                sort,
            })
            .await
            .map_err(|error| AppError::internal(format!("查询约队列表失败: {error}")))?;

        for item in &mut items {
            item.can_accept = match item.challenge.kind {
                ChallengeKind::Team => {
                    can_manage_team
                        && item.challenge.status == ChallengeStatus::Open
                        && item.challenge.host_team_id != team_id
                }
                ChallengeKind::Individual => {
                    item.challenge.status == ChallengeStatus::Open
                        && item.accepted_count < item.challenge.players_per_team
                        && !item.current_user_joined
                }
            };
        }

        Ok(items)
    }

    pub async fn list_public(
        &self,
        keyword: Option<&str>,
        status: Option<ChallengeStatus>,
        include_closed: bool,
        limit: i64,
        sort: &str,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        self.repository
            .list_for_admin(AdminChallengeRepositoryQuery {
                accessible_team_ids: None,
                team_id: None,
                keyword,
                status,
                include_closed,
                limit,
                sort,
            })
            .await
            .map_err(|error| AppError::internal(format!("查询公开约队列表失败: {error}")))
    }

    pub async fn get_detail(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
    ) -> Result<Option<ChallengeDetail>, AppError> {
        self.repository
            .get_detail(challenge_id, Some(actor.id))
            .await
            .map_err(|error| AppError::internal(format!("查询约队详情失败: {error}")))
    }

    pub async fn list_for_admin(
        &self,
        actor: &ActorContext,
        query: AdminChallengeListQuery,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        if actor.actor_kind != ActorKind::Admin {
            return Err(AppError::Forbidden);
        }

        let accessible_team_ids = if actor.is_super_admin {
            None
        } else {
            Some(
                self.team_repository
                    .list_teams_by_admin(actor.id)
                    .await
                    .map_err(|error| AppError::internal(format!("查询管理员球队失败: {error}")))?
                    .into_iter()
                    .map(|team| team.id)
                    .collect::<Vec<_>>(),
            )
        };

        self.repository
            .list_for_admin(AdminChallengeRepositoryQuery {
                accessible_team_ids: accessible_team_ids.as_deref(),
                team_id: query.team_id.as_deref(),
                keyword: query.keyword.as_deref(),
                status: query.status,
                include_closed: query.include_closed,
                limit: query.limit,
                sort: &query.sort,
            })
            .await
            .map_err(|error| AppError::internal(format!("查询后台约队列表失败: {error}")))
    }

    async fn accept_team_challenge(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
        challenge: Challenge,
        command: AcceptChallengeCommand,
    ) -> Result<Challenge, AppError> {
        let guest_team_id = command
            .guest_team_id
            .ok_or_else(|| AppError::Validation("球队约队需要选择接约球队".to_string()))?;

        if challenge.host_team_id == guest_team_id {
            return Err(AppError::Validation("不能接自己发布的约队".to_string()));
        }

        let host_team = self
            .team_repository
            .find_by_id(&challenge.host_team_id)
            .await
            .map_err(|error| AppError::internal(format!("查询主队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("主队不存在".to_string()))?;
        let guest_team = self
            .team_repository
            .find_by_id(&guest_team_id)
            .await
            .map_err(|error| AppError::internal(format!("查询客队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("接约球队不存在".to_string()))?;

        if !self.is_team_manager(&guest_team_id, actor.id).await? {
            return Err(AppError::Forbidden);
        }

        let now = Utc::now().naive_utc();
        let activity = Activity {
            id: Uuid::new_v4().to_string(),
            cover: None,
            start_time: challenge.start_time,
            end_time: challenge.end_time,
            holding_date: challenge.holding_date,
            location: challenge.location.clone(),
            location_latitude: challenge.location_latitude,
            location_longitude: challenge.location_longitude,
            name: challenge.title.clone(),
            opposing: Some(format!("{} vs {}", host_team.name, guest_team.name)),
            status: 0,
            description: challenge.note.clone(),
            home_team_id: Some(challenge.host_team_id.clone()),
            away_team_id: Some(guest_team_id.clone()),
            color: None,
            opposing_color: None,
            players_per_team: Some(challenge.players_per_team),
            source_activity_id: None,
            team_registration_count: None,
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        };

        let challenge = self
            .repository
            .accept_with_activity(challenge_id, &guest_team_id, actor.id, &activity)
            .await
            .map_err(|error| AppError::internal(format!("接约失败: {error}")))?;

        let host_members = self
            .team_repository
            .list_members(&host_team.id)
            .await
            .map_err(|error| AppError::internal(format!("查询主队成员失败: {error}")))?;
        let guest_members = self
            .team_repository
            .list_members(&guest_team.id)
            .await
            .map_err(|error| AppError::internal(format!("查询客队成员失败: {error}")))?;
        let recipient_ids = host_members
            .into_iter()
            .chain(guest_members.into_iter())
            .filter(|member| member.status == 1)
            .map(|member| member.user_id)
            .chain([challenge.host_user_id, actor.id])
            .collect::<Vec<_>>();

        self.notification_service
            .send_to_users(
                &recipient_ids,
                "challenge_matched",
                "约队已约成",
                &format!(
                    "{} 与 {} 已约成，比赛“{}”待报名。",
                    host_team.name, guest_team.name, challenge.title
                ),
                Some("challenge"),
                Some(&challenge.id),
            )
            .await?;

        Ok(challenge)
    }

    async fn accept_individual_challenge(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
        challenge: Challenge,
    ) -> Result<Challenge, AppError> {
        let accepted_count = self
            .repository
            .count_individual_acceptances(challenge_id)
            .await
            .map_err(|error| AppError::internal(format!("查询散人接约人数失败: {error}")))?;

        if accepted_count >= i64::from(challenge.players_per_team) {
            return Err(AppError::Conflict("该散人约队已满员".to_string()));
        }

        let has_overlap = self
            .repository
            .user_has_overlapping_individual_acceptance(
                actor.id,
                challenge_id,
                challenge.start_time,
                challenge.end_time,
            )
            .await
            .map_err(|error| AppError::internal(format!("校验散人约队时间冲突失败: {error}")))?;

        if has_overlap {
            return Err(AppError::Conflict("同一时间只能接一场散人约队".to_string()));
        }

        self.repository
            .accept_individual(challenge_id, actor.id)
            .await
            .map_err(|error| match error {
                crate::challenge::domain::DomainError::Conflict(message) => {
                    AppError::Conflict(message)
                }
                other => AppError::internal(format!("散人接约失败: {other}")),
            })
    }
}
