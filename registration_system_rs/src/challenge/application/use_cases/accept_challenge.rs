use crate::activity::domain::Activity;
use crate::challenge::application::commands::AcceptChallengeCommand;
use crate::challenge::application::notifier::ChallengeNotifier;
use crate::challenge::application::permission::ChallengeTeamAccessChecker;
use crate::challenge::domain::{
    Challenge, ChallengeKind, ChallengePaymentMode, ChallengeStatus,
    IndividualAcceptancePaymentStatus,
};
use crate::challenge::ports::{
    AcceptIndividualFields, ChallengeCommandRepository, ChallengeQueryRepository,
};
use crate::shared::auth::{ActorContext, ActorKind};
use crate::shared::error::AppError;
use crate::team::ports::TeamQueryRepository;
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct AcceptChallengeUseCase {
    query_repository: Arc<dyn ChallengeQueryRepository>,
    command_repository: Arc<dyn ChallengeCommandRepository>,
    team_repository: Arc<dyn TeamQueryRepository>,
    team_access_checker: ChallengeTeamAccessChecker,
    notifier: ChallengeNotifier,
}

impl AcceptChallengeUseCase {
    pub fn new(
        query_repository: Arc<dyn ChallengeQueryRepository>,
        command_repository: Arc<dyn ChallengeCommandRepository>,
        team_repository: Arc<dyn TeamQueryRepository>,
        team_access_checker: ChallengeTeamAccessChecker,
        notifier: ChallengeNotifier,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            team_repository,
            team_access_checker,
            notifier,
        }
    }

    pub async fn execute(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
        command: AcceptChallengeCommand,
    ) -> Result<Challenge, AppError> {
        if actor.actor_kind != ActorKind::User {
            return Err(AppError::Forbidden);
        }

        let challenge = self
            .query_repository
            .find_by_id(challenge_id)
            .await
            .map_err(|error| AppError::internal(format!("查询约队失败: {error}")))?
            .ok_or_else(|| AppError::NotFound("约队不存在".to_string()))?;

        match challenge.kind {
            ChallengeKind::Team => {
                if challenge.status != ChallengeStatus::Open {
                    return Err(AppError::Conflict("该约队当前不可接".to_string()));
                }
                self.accept_team_challenge(actor, challenge_id, challenge, command)
                    .await
            }
            ChallengeKind::Individual => {
                if challenge.status == ChallengeStatus::Cancelled {
                    return Err(AppError::Conflict("该约队当前不可接".to_string()));
                }
                self.accept_individual_challenge(actor, challenge_id, challenge)
                    .await
            }
        }
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

        let guest_team = self
            .team_access_checker
            .get_team(guest_team_id, "查询客队失败", "接约球队不存在")
            .await?;

        if !self
            .team_access_checker
            .is_team_manager(guest_team_id, actor.id)
            .await?
        {
            return Err(AppError::Forbidden);
        }

        if let Some(host_team_id) = challenge.host_team_id {
            if host_team_id == guest_team_id {
                return Err(AppError::Validation("不能接自己发布的约队".to_string()));
            }
            let host_team = self
                .team_access_checker
                .get_team(host_team_id, "查询主队失败", "主队不存在")
                .await?;
            return self
                .match_team_challenge(actor, challenge_id, challenge, host_team, guest_team)
                .await;
        }

        self.reserve_venue_team_challenge(actor, challenge_id, challenge, guest_team)
            .await
    }

    async fn reserve_venue_team_challenge(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
        challenge: Challenge,
        host_team: crate::team::domain::Team,
    ) -> Result<Challenge, AppError> {
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
            opposing: Some("等待对手".to_string()),
            status: 0,
            description: challenge.note.clone(),
            home_team_id: Some(host_team.id),
            away_team_id: None,
            color: None,
            opposing_color: None,
            players_per_team: Some(challenge.players_per_team),
            match_kind: Some("external".to_string()),
            source_activity_id: None,
            team_registration_count: None,
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        };

        self.command_repository
            .accept_as_host_team(challenge_id, host_team.id, actor.id, &activity)
            .await
            .map_err(|error| match error {
                crate::challenge::domain::DomainError::Conflict(message) => {
                    AppError::Conflict(message)
                }
                other => AppError::internal(format!("报名场馆约队失败: {other}")),
            })
    }

    async fn match_team_challenge(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
        challenge: Challenge,
        host_team: crate::team::domain::Team,
        guest_team: crate::team::domain::Team,
    ) -> Result<Challenge, AppError> {
        let now = Utc::now().naive_utc();
        let activity = Activity {
            id: challenge
                .activity_id
                .clone()
                .unwrap_or_else(|| Uuid::new_v4().to_string()),
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
            home_team_id: Some(host_team.id),
            away_team_id: Some(guest_team.id),
            color: None,
            opposing_color: None,
            players_per_team: Some(challenge.players_per_team),
            match_kind: Some("external".to_string()),
            source_activity_id: None,
            team_registration_count: None,
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        };

        let challenge = self
            .command_repository
            .accept_with_activity(challenge_id, guest_team.id, actor.id, &activity)
            .await
            .map_err(|error| AppError::internal(format!("接约失败: {error}")))?;

        let host_members = self
            .team_repository
            .list_members(host_team.id)
            .await
            .map_err(|error| AppError::internal(format!("查询主队成员失败: {error}")))?;
        let guest_members = self
            .team_repository
            .list_members(guest_team.id)
            .await
            .map_err(|error| AppError::internal(format!("查询客队成员失败: {error}")))?;
        let recipient_ids = host_members
            .into_iter()
            .chain(guest_members.into_iter())
            .filter(|member| member.status == 1)
            .map(|member| member.user_id)
            .chain([challenge.host_user_id, actor.id])
            .collect::<Vec<_>>();

        self.notifier
            .challenge_matched(
                &recipient_ids,
                &challenge,
                &host_team.name,
                &guest_team.name,
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
            .query_repository
            .count_individual_acceptances(challenge_id)
            .await
            .map_err(|error| AppError::internal(format!("查询散人接约人数失败: {error}")))?;

        if accepted_count >= i64::from(challenge.max_signup_players()) {
            return Err(AppError::Conflict("该散人约队已满员".to_string()));
        }

        let has_overlap = self
            .query_repository
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

        self.command_repository
            .accept_individual(AcceptIndividualFields {
                challenge_id,
                user_id: actor.id,
                payment_status: IndividualAcceptancePaymentStatus::Unpaid,
                payment_deadline_at: calculate_payment_deadline(&challenge),
            })
            .await
            .map_err(|error| match error {
                crate::challenge::domain::DomainError::Conflict(message) => {
                    AppError::Conflict(message)
                }
                other => AppError::internal(format!("散人接约失败: {other}")),
            })
    }
}

fn calculate_payment_deadline(challenge: &Challenge) -> Option<chrono::NaiveDateTime> {
    if challenge.payment_mode != ChallengePaymentMode::Prepaid {
        return None;
    }
    if challenge
        .fee_per_person
        .is_none_or(|amount| amount <= rust_decimal::Decimal::ZERO)
    {
        return None;
    }
    let twenty_minutes_later = Utc::now().naive_utc() + chrono::Duration::minutes(20);
    Some(std::cmp::min(twenty_minutes_later, challenge.start_time))
}
