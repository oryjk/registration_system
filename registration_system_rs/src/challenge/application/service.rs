use crate::challenge::application::commands::{AcceptChallengeCommand, CreateChallengeCommand};
use crate::challenge::application::notifier::ChallengeNotifier;
use crate::challenge::application::permission::ChallengeTeamAccessChecker;
use crate::challenge::application::queries::{AdminChallengeListQuery, TeamChallengeListRequest};
use crate::challenge::application::use_cases::{
    AcceptChallengeUseCase, CancelChallengeUseCase, CreateChallengeUseCase,
    GetChallengeDetailUseCase, ListChallengesUseCase,
};
use crate::challenge::domain::{Challenge, ChallengeDetail, ChallengeStatus, ChallengeSummary};
use crate::challenge::ports::{ChallengeCommandRepository, ChallengeQueryRepository};
use crate::notification::application::NotificationService;
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct ChallengeService {
    accept_challenge_use_case: AcceptChallengeUseCase,
    cancel_challenge_use_case: CancelChallengeUseCase,
    create_challenge_use_case: CreateChallengeUseCase,
    get_challenge_detail_use_case: GetChallengeDetailUseCase,
    list_challenges_use_case: ListChallengesUseCase,
}

impl ChallengeService {
    pub fn new(
        query_repository: Arc<dyn ChallengeQueryRepository>,
        command_repository: Arc<dyn ChallengeCommandRepository>,
        team_repository: Arc<dyn TeamQueryRepository>,
        notification_service: Arc<NotificationService>,
    ) -> Self {
        let team_access_checker = ChallengeTeamAccessChecker::new(team_repository.clone());
        let notifier = ChallengeNotifier::new(notification_service);

        Self {
            accept_challenge_use_case: AcceptChallengeUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
                team_repository.clone(),
                team_access_checker.clone(),
                notifier.clone(),
            ),
            cancel_challenge_use_case: CancelChallengeUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
                team_access_checker.clone(),
                notifier.clone(),
            ),
            create_challenge_use_case: CreateChallengeUseCase::new(
                command_repository,
                team_access_checker.clone(),
                notifier,
            ),
            get_challenge_detail_use_case: GetChallengeDetailUseCase::new(query_repository.clone()),
            list_challenges_use_case: ListChallengesUseCase::new(
                query_repository,
                team_repository,
                team_access_checker,
            ),
        }
    }

    pub async fn create_challenge(
        &self,
        actor: &ActorContext,
        command: CreateChallengeCommand,
    ) -> Result<Challenge, AppError> {
        self.create_challenge_use_case.execute(actor, command).await
    }

    pub async fn accept_challenge(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
        command: AcceptChallengeCommand,
    ) -> Result<Challenge, AppError> {
        self.accept_challenge_use_case
            .execute(actor, challenge_id, command)
            .await
    }

    pub async fn cancel_challenge(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
    ) -> Result<Challenge, AppError> {
        self.cancel_challenge_use_case
            .execute(actor, challenge_id)
            .await
    }

    pub async fn list_for_team(
        &self,
        actor: &ActorContext,
        query: TeamChallengeListRequest<'_>,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        self.list_challenges_use_case
            .list_for_team(actor, query)
            .await
    }

    pub async fn list_public(
        &self,
        keyword: Option<&str>,
        status: Option<ChallengeStatus>,
        include_closed: bool,
        limit: i64,
        sort: &str,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        self.list_challenges_use_case
            .list_public(keyword, status, include_closed, limit, sort)
            .await
    }

    pub async fn get_detail(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
    ) -> Result<Option<ChallengeDetail>, AppError> {
        self.get_challenge_detail_use_case
            .execute(actor, challenge_id)
            .await
    }

    pub async fn list_for_admin(
        &self,
        actor: &ActorContext,
        query: AdminChallengeListQuery,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        self.list_challenges_use_case
            .list_for_admin(actor, query)
            .await
    }
}
