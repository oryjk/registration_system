use crate::challenge::application::commands::{
    AcceptChallengeCommand, CreateChallengeCommand, UpdateChallengeCommand,
};
use crate::challenge::application::notifier::ChallengeNotifier;
use crate::challenge::application::permission::ChallengeTeamAccessChecker;
use crate::challenge::application::queries::{
    AdminChallengeListQuery, PublicChallengeListQuery, TeamChallengeListRequest,
};
use crate::challenge::application::use_cases::{
    AcceptChallengeUseCase, CancelChallengeUseCase, CancelIndividualAcceptanceUseCase,
    CreateChallengeUseCase, GetChallengeDetailUseCase, ListChallengesUseCase,
    UpdateChallengeUseCase,
};
use crate::challenge::domain::{Challenge, ChallengeDetail, ChallengeSummary};
use crate::challenge::ports::{ChallengeCommandRepository, ChallengeQueryRepository};
use crate::notification::application::NotificationService;
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::team::ports::TeamQueryRepository;
use crate::user::ports::UserQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct ChallengeService {
    accept_challenge_use_case: AcceptChallengeUseCase,
    cancel_challenge_use_case: CancelChallengeUseCase,
    cancel_individual_acceptance_use_case: CancelIndividualAcceptanceUseCase,
    create_challenge_use_case: CreateChallengeUseCase,
    get_challenge_detail_use_case: GetChallengeDetailUseCase,
    list_challenges_use_case: ListChallengesUseCase,
    update_challenge_use_case: UpdateChallengeUseCase,
}

impl ChallengeService {
    pub fn new(
        query_repository: Arc<dyn ChallengeQueryRepository>,
        command_repository: Arc<dyn ChallengeCommandRepository>,
        team_repository: Arc<dyn TeamQueryRepository>,
        user_repository: Arc<dyn UserQueryRepository>,
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
                team_repository.clone(),
                user_repository.clone(),
                notifier.clone(),
            ),
            cancel_individual_acceptance_use_case: CancelIndividualAcceptanceUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
            ),
            create_challenge_use_case: CreateChallengeUseCase::new(
                command_repository.clone(),
                team_access_checker.clone(),
                user_repository.clone(),
                notifier.clone(),
            ),
            get_challenge_detail_use_case: GetChallengeDetailUseCase::new(query_repository.clone()),
            list_challenges_use_case: ListChallengesUseCase::new(
                query_repository.clone(),
                team_repository.clone(),
                team_access_checker.clone(),
            ),
            update_challenge_use_case: UpdateChallengeUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
                team_repository.clone(),
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

    pub async fn update_challenge(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
        command: UpdateChallengeCommand,
    ) -> Result<Challenge, AppError> {
        self.update_challenge_use_case
            .execute(actor, challenge_id, command)
            .await
    }

    pub async fn cancel_individual_acceptance(
        &self,
        actor: &ActorContext,
        challenge_id: &str,
    ) -> Result<Challenge, AppError> {
        self.cancel_individual_acceptance_use_case
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
        query: PublicChallengeListQuery<'_>,
    ) -> Result<Vec<ChallengeSummary>, AppError> {
        self.list_challenges_use_case.list_public(query).await
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
