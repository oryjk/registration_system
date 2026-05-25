use async_trait::async_trait;
use chrono::{Duration, Utc};
use registration_system_backend::activity::domain::Activity;
use registration_system_backend::challenge::application::{
    AcceptChallengeCommand, AdminChallengeListQuery, ChallengeService, CreateChallengeCommand,
    PublicChallengeListQuery, UpdateChallengeCommand,
};
use registration_system_backend::challenge::domain::{
    Challenge, ChallengeDetail, ChallengeKind, ChallengePaymentMode, ChallengeStatus,
    ChallengeSummary, CurrentUserIndividualAcceptance, DomainError,
    IndividualAcceptancePaymentStatus,
};
use registration_system_backend::challenge::ports::{
    AcceptIndividualFields, AdminChallengeRepositoryQuery, ChallengeCommandRepository,
    ChallengeQueryRepository, ExpiredIndividualAcceptance, PostpaidUnpaidAcceptance,
    TeamChallengeListQuery, UpdateChallengeFields,
};
use registration_system_backend::notification::application::NotificationService;
use registration_system_backend::notification::domain::{
    DomainError as NotificationDomainError, Notification,
};
use registration_system_backend::notification::ports::{
    NotificationCommandRepository, NotificationQueryRepository,
};
use registration_system_backend::shared::auth::{ActorContext, ActorKind};
use registration_system_backend::team::domain::{
    ActivityTeamReview, DEFAULT_TEAM_CREDIT_SCORE, DomainError as TeamDomainError, Team,
    TeamAdminInfo, TeamAttendanceRankingItem, TeamCreditTransaction, TeamMember,
    TeamMemberAttendanceRecord, TeamMemberWithInfo,
};
use registration_system_backend::team::ports::TeamQueryRepository;
use registration_system_backend::user::domain::{
    DomainError as UserDomainError, PlayerAdminListQuery, PlayerListResult, PlayerTeamSummary,
    User, UserActivityRecord, UserAttendanceRanking, UserAttendanceRecord,
};
use registration_system_backend::user::ports::UserQueryRepository;
use rust_decimal::Decimal;
use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct FakeChallengeRepository {
    challenges: Mutex<HashMap<String, Challenge>>,
    created_activity: Mutex<Option<Activity>>,
    individual_acceptances: Mutex<HashMap<String, BTreeSet<i64>>>,
    individual_acceptance_payments: Mutex<HashMap<(String, i64), CurrentUserIndividualAcceptance>>,
    notified_postpaid_acceptances: Mutex<BTreeSet<(String, i64)>>,
}

#[async_trait]
impl ChallengeQueryRepository for FakeChallengeRepository {
    async fn find_by_id(&self, challenge_id: &str) -> Result<Option<Challenge>, DomainError> {
        Ok(self.challenges.lock().unwrap().get(challenge_id).cloned())
    }

    async fn list_for_team(
        &self,
        query: TeamChallengeListQuery<'_>,
    ) -> Result<Vec<ChallengeSummary>, DomainError> {
        let keyword = query.keyword.map(|value| value.trim().to_string());
        let mut items = self
            .challenges
            .lock()
            .unwrap()
            .values()
            .filter(|challenge| {
                query.include_closed || challenge.status != ChallengeStatus::Cancelled
            })
            .filter(|challenge| {
                query
                    .status
                    .is_none_or(|expected| challenge.status == expected)
            })
            .filter(|challenge| query.kind.is_none_or(|expected| challenge.kind == expected))
            .filter(|challenge| {
                challenge.status == ChallengeStatus::Open
                    || challenge.host_team_id == Some(query.team_id)
                    || challenge.guest_team_id == Some(query.team_id)
            })
            .filter(|challenge| {
                keyword.as_ref().is_none_or(|expected| {
                    challenge.title.contains(expected) || challenge.location.contains(expected)
                })
            })
            .cloned()
            .collect::<Vec<_>>();
        items.sort_by(|left, right| left.holding_date.cmp(&right.holding_date));
        items.truncate(query.limit.max(1) as usize);

        Ok(items
            .into_iter()
            .map(|challenge| {
                let accepted_count = self
                    .individual_acceptances
                    .lock()
                    .unwrap()
                    .get(&challenge.id)
                    .map(|items| items.len() as i32)
                    .unwrap_or(0);
                let current_user_joined = self
                    .individual_acceptances
                    .lock()
                    .unwrap()
                    .get(&challenge.id)
                    .is_some_and(|items| items.contains(&query.user_id));

                ChallengeSummary {
                    current_team_relation: Some(
                        if challenge.host_team_id == Some(query.team_id) {
                            "host"
                        } else if challenge.guest_team_id == Some(query.team_id) {
                            "guest"
                        } else {
                            "viewer"
                        }
                        .to_string(),
                    ),
                    accepted_count,
                    current_user_joined,
                    can_accept: challenge.status == ChallengeStatus::Open
                        && challenge.host_team_id != Some(query.team_id),
                    host_team_name: challenge
                        .host_team_id
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "场馆约队".to_string()),
                    host_team_credit_score: 90,
                    host_team_trust_label: "稳定赴约".to_string(),
                    guest_team_name: challenge.guest_team_id.map(|value| value.to_string()),
                    guest_team_credit_score: Some(85),
                    guest_team_trust_label: Some("稳定赴约".to_string()),
                    individual_participant_preview: Vec::new(),
                    challenge,
                }
            })
            .collect())
    }

    async fn list_for_admin(
        &self,
        query: AdminChallengeRepositoryQuery<'_>,
    ) -> Result<Vec<ChallengeSummary>, DomainError> {
        let keyword = query.keyword.map(|value| value.trim().to_string());
        let mut items = self
            .challenges
            .lock()
            .unwrap()
            .values()
            .filter(|challenge| {
                query.include_closed || challenge.status != ChallengeStatus::Cancelled
            })
            .filter(|challenge| {
                query
                    .status
                    .is_none_or(|expected| challenge.status == expected)
            })
            .filter(|challenge| query.kind.is_none_or(|expected| challenge.kind == expected))
            .filter(|challenge| {
                query.team_id.is_none_or(|expected| {
                    challenge.host_team_id == Some(expected)
                        || challenge.guest_team_id == Some(expected)
                })
            })
            .filter(|challenge| {
                keyword.as_ref().is_none_or(|expected| {
                    challenge.title.contains(expected) || challenge.location.contains(expected)
                })
            })
            .cloned()
            .collect::<Vec<_>>();
        items.sort_by(|left, right| left.holding_date.cmp(&right.holding_date));
        items.truncate(query.limit.max(1) as usize);

        Ok(items
            .into_iter()
            .map(|challenge| {
                let accepted_count = self
                    .individual_acceptances
                    .lock()
                    .unwrap()
                    .get(&challenge.id)
                    .map(|items| items.len() as i32)
                    .unwrap_or(0);
                let current_user_joined = query.viewer_user_id.is_some_and(|viewer_id| {
                    self.individual_acceptances
                        .lock()
                        .unwrap()
                        .get(&challenge.id)
                        .is_some_and(|items| items.contains(&viewer_id))
                });

                ChallengeSummary {
                    host_team_name: challenge
                        .host_team_id
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "场馆约队".to_string()),
                    host_team_credit_score: 90,
                    host_team_trust_label: "稳定赴约".to_string(),
                    guest_team_name: challenge.guest_team_id.map(|value| value.to_string()),
                    guest_team_credit_score: Some(85),
                    guest_team_trust_label: Some("稳定赴约".to_string()),
                    current_team_relation: None,
                    accepted_count,
                    current_user_joined,
                    can_accept: false,
                    individual_participant_preview: Vec::new(),
                    challenge,
                }
            })
            .collect())
    }

    async fn get_detail(
        &self,
        challenge_id: &str,
        user_id: Option<i64>,
    ) -> Result<Option<ChallengeDetail>, DomainError> {
        Ok(self
            .challenges
            .lock()
            .unwrap()
            .get(challenge_id)
            .cloned()
            .map(|challenge| {
                let accepted_count = self
                    .individual_acceptances
                    .lock()
                    .unwrap()
                    .get(&challenge.id)
                    .map(|items| items.len() as i32)
                    .unwrap_or(0);
                let current_user_joined = user_id.is_some_and(|viewer_id| {
                    self.individual_acceptances
                        .lock()
                        .unwrap()
                        .get(&challenge.id)
                        .is_some_and(|items| items.contains(&viewer_id))
                });

                ChallengeDetail {
                    summary: ChallengeSummary {
                        challenge: challenge.clone(),
                        host_team_name: "主队".to_string(),
                        host_team_credit_score: 90,
                        host_team_trust_label: "稳定赴约".to_string(),
                        guest_team_name: None,
                        guest_team_credit_score: None,
                        guest_team_trust_label: None,
                        current_team_relation: None,
                        accepted_count,
                        current_user_joined,
                        can_accept: false,
                        individual_participant_preview: Vec::new(),
                    },
                    activity: None,
                    individual_participants: Vec::new(),
                    current_user_acceptance: user_id.and_then(|viewer_id| {
                        self.individual_acceptance_payments
                            .lock()
                            .unwrap()
                            .get(&(challenge.id.clone(), viewer_id))
                            .cloned()
                    }),
                }
            }))
    }

    async fn count_individual_acceptances(&self, challenge_id: &str) -> Result<i64, DomainError> {
        Ok(self
            .individual_acceptances
            .lock()
            .unwrap()
            .get(challenge_id)
            .map(|items| items.len() as i64)
            .unwrap_or(0))
    }

    async fn user_has_overlapping_individual_acceptance(
        &self,
        user_id: i64,
        challenge_id: &str,
        start_time: chrono::NaiveDateTime,
        end_time: chrono::NaiveDateTime,
    ) -> Result<bool, DomainError> {
        let challenges = self.challenges.lock().unwrap();
        let acceptances = self.individual_acceptances.lock().unwrap();

        Ok(acceptances.iter().any(|(accepted_challenge_id, users)| {
            accepted_challenge_id != challenge_id
                && users.contains(&user_id)
                && challenges
                    .get(accepted_challenge_id)
                    .is_some_and(|challenge| {
                        challenge.kind == ChallengeKind::Individual
                            && challenge.status != ChallengeStatus::Cancelled
                            && challenge.start_time < end_time
                            && challenge.end_time > start_time
                    })
        }))
    }
}

#[async_trait]
impl ChallengeCommandRepository for FakeChallengeRepository {
    async fn create(&self, challenge: &Challenge) -> Result<(), DomainError> {
        self.challenges
            .lock()
            .unwrap()
            .insert(challenge.id.clone(), challenge.clone());
        Ok(())
    }

    async fn accept_with_activity(
        &self,
        challenge_id: &str,
        guest_team_id: i64,
        accepted_by_user_id: i64,
        activity: &Activity,
    ) -> Result<Challenge, DomainError> {
        let mut items = self.challenges.lock().unwrap();
        let challenge = items
            .get_mut(challenge_id)
            .ok_or_else(|| DomainError::NotFound("challenge not found".to_string()))?;
        challenge.status = ChallengeStatus::Matched;
        challenge.guest_team_id = Some(guest_team_id);
        challenge.accepted_by_user_id = Some(accepted_by_user_id);
        challenge.activity_id = Some(activity.id.clone());
        challenge.accepted_at = Some(Utc::now().naive_utc());
        challenge.updated_at = Utc::now().naive_utc();
        self.created_activity
            .lock()
            .unwrap()
            .replace(activity.clone());
        Ok(challenge.clone())
    }

    async fn accept_as_host_team(
        &self,
        challenge_id: &str,
        host_team_id: i64,
        accepted_by_user_id: i64,
        activity: &Activity,
    ) -> Result<Challenge, DomainError> {
        let mut items = self.challenges.lock().unwrap();
        let challenge = items
            .get_mut(challenge_id)
            .ok_or_else(|| DomainError::NotFound("challenge not found".to_string()))?;
        if challenge.status != ChallengeStatus::Open {
            return Err(DomainError::Conflict("该约队当前不可接".to_string()));
        }
        if challenge.host_team_id.is_some() {
            return Err(DomainError::Conflict(
                "已有球队报名，等待另一支球队接约".to_string(),
            ));
        }
        challenge.host_team_id = Some(host_team_id);
        challenge.accepted_by_user_id = Some(accepted_by_user_id);
        challenge.activity_id = Some(activity.id.clone());
        challenge.accepted_at = Some(Utc::now().naive_utc());
        challenge.updated_at = Utc::now().naive_utc();
        self.created_activity
            .lock()
            .unwrap()
            .replace(activity.clone());
        Ok(challenge.clone())
    }

    async fn accept_individual(
        &self,
        fields: AcceptIndividualFields<'_>,
    ) -> Result<Challenge, DomainError> {
        let mut acceptances = self.individual_acceptances.lock().unwrap();
        let accepted_users = acceptances
            .entry(fields.challenge_id.to_string())
            .or_default();

        if !accepted_users.insert(fields.user_id) {
            return Err(DomainError::Conflict("你已接过这场散人约队".to_string()));
        }
        self.individual_acceptance_payments.lock().unwrap().insert(
            (fields.challenge_id.to_string(), fields.user_id),
            CurrentUserIndividualAcceptance {
                payment_status: fields.payment_status,
                payment_deadline_at: fields.payment_deadline_at,
                payment_order_no: None,
            },
        );

        let accepted_count = accepted_users.len() as i32;
        drop(acceptances);

        let mut items = self.challenges.lock().unwrap();
        let challenge = items
            .get_mut(fields.challenge_id)
            .ok_or_else(|| DomainError::NotFound("challenge not found".to_string()))?;
        if accepted_count >= challenge.min_signup_players() {
            challenge.status = ChallengeStatus::Matched;
            challenge.accepted_at = Some(Utc::now().naive_utc());
        }
        challenge.updated_at = Utc::now().naive_utc();
        Ok(challenge.clone())
    }

    async fn cancel_individual_acceptance(
        &self,
        challenge_id: &str,
        user_id: i64,
    ) -> Result<Challenge, DomainError> {
        let mut acceptances = self.individual_acceptances.lock().unwrap();
        let accepted_users = acceptances
            .get_mut(challenge_id)
            .ok_or_else(|| DomainError::Conflict("你还没有报名这场散人约队".to_string()))?;

        if !accepted_users.remove(&user_id) {
            return Err(DomainError::Conflict(
                "你还没有报名这场散人约队".to_string(),
            ));
        }
        let accepted_count = accepted_users.len() as i32;
        drop(acceptances);

        let mut items = self.challenges.lock().unwrap();
        let challenge = items
            .get_mut(challenge_id)
            .ok_or_else(|| DomainError::NotFound("challenge not found".to_string()))?;
        challenge.status = if accepted_count >= challenge.min_signup_players() {
            ChallengeStatus::Matched
        } else {
            ChallengeStatus::Open
        };
        challenge.updated_at = Utc::now().naive_utc();
        Ok(challenge.clone())
    }

    async fn update(
        &self,
        challenge_id: &str,
        fields: UpdateChallengeFields<'_>,
    ) -> Result<Challenge, DomainError> {
        let mut items = self.challenges.lock().unwrap();
        let challenge = items
            .get_mut(challenge_id)
            .ok_or_else(|| DomainError::NotFound("challenge not found".to_string()))?;
        challenge.title = fields.title.to_string();
        challenge.holding_date = fields.holding_date;
        challenge.start_time = fields.start_time;
        challenge.end_time = fields.end_time;
        challenge.location = fields.location.to_string();
        challenge.location_latitude = fields.location_latitude;
        challenge.location_longitude = fields.location_longitude;
        challenge.players_per_team = fields.players_per_team;
        challenge.min_players = fields.min_players;
        challenge.max_players = fields.max_players;
        challenge.fee_per_person = fields.fee_per_person;
        challenge.note = fields.note.map(ToString::to_string);
        challenge.updated_at = Utc::now().naive_utc();
        Ok(challenge.clone())
    }

    async fn cancel(
        &self,
        challenge_id: &str,
        _cancelled_by_user_id: i64,
    ) -> Result<Challenge, DomainError> {
        let mut items = self.challenges.lock().unwrap();
        let challenge = items
            .get_mut(challenge_id)
            .ok_or_else(|| DomainError::NotFound("challenge not found".to_string()))?;
        challenge.status = ChallengeStatus::Cancelled;
        challenge.cancelled_at = Some(Utc::now().naive_utc());
        challenge.updated_at = Utc::now().naive_utc();
        Ok(challenge.clone())
    }

    async fn cancel_expired_prepaid_acceptances(
        &self,
        now: chrono::NaiveDateTime,
    ) -> Result<Vec<ExpiredIndividualAcceptance>, DomainError> {
        let expired_keys = self
            .individual_acceptance_payments
            .lock()
            .unwrap()
            .iter()
            .filter(|(_, acceptance)| {
                acceptance.payment_status == IndividualAcceptancePaymentStatus::Unpaid
                    && acceptance
                        .payment_deadline_at
                        .is_some_and(|deadline| deadline <= now)
            })
            .map(|((challenge_id, user_id), _)| (challenge_id.clone(), *user_id))
            .collect::<Vec<_>>();

        for (challenge_id, user_id) in &expired_keys {
            self.individual_acceptance_payments
                .lock()
                .unwrap()
                .remove(&(challenge_id.clone(), *user_id));
            if let Some(users) = self
                .individual_acceptances
                .lock()
                .unwrap()
                .get_mut(challenge_id)
            {
                users.remove(user_id);
            }
            if let Some(challenge) = self.challenges.lock().unwrap().get_mut(challenge_id) {
                challenge.status = ChallengeStatus::Open;
                challenge.updated_at = now;
            }
        }

        Ok(expired_keys
            .into_iter()
            .map(|(challenge_id, user_id)| ExpiredIndividualAcceptance {
                challenge_id,
                user_id,
            })
            .collect())
    }

    async fn mark_postpaid_unpaid_acceptances_notified(
        &self,
        now: chrono::NaiveDateTime,
    ) -> Result<Vec<PostpaidUnpaidAcceptance>, DomainError> {
        let challenges = self.challenges.lock().unwrap().clone();
        let payment_items = self.individual_acceptance_payments.lock().unwrap().clone();
        let mut notified = self.notified_postpaid_acceptances.lock().unwrap();
        let mut result = Vec::new();

        for ((challenge_id, user_id), acceptance) in payment_items {
            let Some(challenge) = challenges.get(&challenge_id) else {
                continue;
            };
            if challenge.payment_mode == ChallengePaymentMode::Postpaid
                && challenge.end_time <= now
                && acceptance.payment_status == IndividualAcceptancePaymentStatus::Unpaid
                && !notified.contains(&(challenge_id.clone(), user_id))
            {
                notified.insert((challenge_id.clone(), user_id));
                result.push(PostpaidUnpaidAcceptance {
                    challenge_id,
                    user_id,
                    title: challenge.title.clone(),
                });
            }
        }

        Ok(result)
    }
}

#[tokio::test]
async fn public_challenge_list_does_not_require_current_user_or_team() {
    let challenge_repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![]));
    let notification_repository = Arc::new(FakeNotificationRepository::default());
    let service = ChallengeService::new(
        challenge_repository.clone(),
        challenge_repository.clone(),
        team_repository,
        Arc::new(FakeUserStore::default()),
        Arc::new(NotificationService::new(
            notification_repository.clone(),
            notification_repository,
        )),
    );
    let now = Utc::now().naive_utc();
    let open_challenge = Challenge {
        id: "public-open".to_string(),
        title: "公开约队".to_string(),
        kind: ChallengeKind::Team,
        payment_mode: ChallengePaymentMode::Postpaid,
        host_team_id: Some(1),
        host_user_id: 1,
        guest_team_id: None,
        accepted_by_user_id: None,
        activity_id: None,
        holding_date: now,
        start_time: now,
        end_time: now + Duration::hours(2),
        location: "公开球场".to_string(),
        location_latitude: None,
        location_longitude: None,
        players_per_team: 8,
        min_players: None,
        max_players: None,
        fee_per_person: None,
        note: None,
        status: ChallengeStatus::Open,
        accepted_at: None,
        cancelled_at: None,
        created_at: now,
        updated_at: now,
    };

    challenge_repository.create(&open_challenge).await.unwrap();

    let items = service
        .list_public(PublicChallengeListQuery {
            viewer_user_id: None,
            keyword: None,
            status: None,
            kind: None,
            include_closed: false,
            limit: 20,
            sort: "holding_date_asc",
        })
        .await
        .unwrap();

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].challenge.id, "public-open");
    assert_eq!(items[0].current_team_relation, None);
    assert!(!items[0].can_accept);
}

#[tokio::test]
async fn logged_in_public_challenge_list_marks_joined_individual_challenges() {
    let challenge_repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(Vec::new()));
    let service = ChallengeService::new(
        challenge_repository.clone(),
        challenge_repository.clone(),
        team_repository,
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);
    let challenge = Challenge {
        id: "joined-individual".to_string(),
        title: "已报名散人局".to_string(),
        kind: ChallengeKind::Individual,
        payment_mode: ChallengePaymentMode::Postpaid,
        host_team_id: None,
        host_user_id: 7,
        guest_team_id: None,
        accepted_by_user_id: None,
        activity_id: None,
        holding_date,
        start_time: holding_date,
        end_time: holding_date + Duration::hours(2),
        location: "公开球场".to_string(),
        location_latitude: None,
        location_longitude: None,
        players_per_team: 8,
        min_players: None,
        max_players: None,
        fee_per_person: None,
        note: None,
        status: ChallengeStatus::Open,
        accepted_at: None,
        cancelled_at: None,
        created_at: holding_date - Duration::days(1),
        updated_at: holding_date - Duration::days(1),
    };
    challenge_repository.create(&challenge).await.unwrap();
    challenge_repository
        .accept_individual(AcceptIndividualFields {
            challenge_id: &challenge.id,
            user_id: 42,
            payment_status: IndividualAcceptancePaymentStatus::Unpaid,
            payment_deadline_at: None,
        })
        .await
        .unwrap();

    let items = service
        .list_public(PublicChallengeListQuery {
            viewer_user_id: Some(42),
            keyword: None,
            status: None,
            kind: None,
            include_closed: false,
            limit: 20,
            sort: "holding_date_asc",
        })
        .await
        .unwrap();

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].challenge.id, "joined-individual");
    assert_eq!(items[0].accepted_count, 1);
    assert!(items[0].current_user_joined);
}

struct FakeTeamStore {
    teams: Mutex<HashMap<i64, Team>>,
    team_members: Mutex<HashMap<i64, Vec<TeamMember>>>,
    admin_assignments: Mutex<HashMap<i64, BTreeSet<i64>>>,
}

#[derive(Default)]
struct FakeUserStore {
    users: Mutex<HashMap<i64, User>>,
}

impl FakeUserStore {
    fn with_users(users: Vec<User>) -> Self {
        Self {
            users: Mutex::new(users.into_iter().map(|user| (user.id, user)).collect()),
        }
    }
}

#[async_trait]
impl UserQueryRepository for FakeUserStore {
    async fn find_by_open_id(&self, _open_id: &str) -> Result<Option<User>, UserDomainError> {
        unimplemented!()
    }

    async fn find_by_username(&self, _username: &str) -> Result<Option<User>, UserDomainError> {
        unimplemented!()
    }

    async fn find_by_id(&self, user_id: i64) -> Result<Option<User>, UserDomainError> {
        Ok(self.users.lock().unwrap().get(&user_id).cloned())
    }

    async fn list_active(&self) -> Result<Vec<User>, UserDomainError> {
        unimplemented!()
    }

    async fn search(&self, _keyword: &str, _limit: i64) -> Result<Vec<User>, UserDomainError> {
        unimplemented!()
    }

    async fn list_players_admin(
        &self,
        _query: PlayerAdminListQuery<'_>,
    ) -> Result<PlayerListResult, UserDomainError> {
        unimplemented!()
    }

    async fn find_player_teams(
        &self,
        _user_ids: &[i64],
    ) -> Result<Vec<(i64, PlayerTeamSummary)>, UserDomainError> {
        unimplemented!()
    }

    async fn find_activities(
        &self,
        _user_id: i64,
    ) -> Result<Vec<UserActivityRecord>, UserDomainError> {
        unimplemented!()
    }

    async fn find_attendance_records(
        &self,
        _user_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRecord>, UserDomainError> {
        unimplemented!()
    }

    async fn find_attendance_ranking(
        &self,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRanking>, UserDomainError> {
        unimplemented!()
    }

    async fn find_attendance_ranking_for_user(
        &self,
        _user_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Option<UserAttendanceRanking>, UserDomainError> {
        unimplemented!()
    }
}

impl FakeTeamStore {
    fn new(teams: Vec<Team>) -> Self {
        let now = Utc::now().naive_utc();
        let mut team_members = HashMap::new();
        for team in &teams {
            if let Some(captain_id) = team.captain_id {
                team_members.insert(
                    team.id,
                    vec![TeamMember {
                        id: captain_id,
                        team_id: team.id,
                        user_id: captain_id,
                        role: "captain".to_string(),
                        jersey_number: None,
                        is_member: false,
                        joined_at: now,
                        status: 1,
                        created_at: now,
                        updated_at: now,
                    }],
                );
            }
        }

        Self {
            teams: Mutex::new(teams.into_iter().map(|team| (team.id, team)).collect()),
            team_members: Mutex::new(team_members),
            admin_assignments: Mutex::new(HashMap::new()),
        }
    }
}

#[async_trait]
impl TeamQueryRepository for FakeTeamStore {
    async fn find_by_id(&self, team_id: i64) -> Result<Option<Team>, TeamDomainError> {
        Ok(self.teams.lock().unwrap().get(&team_id).cloned())
    }

    async fn find_by_name(&self, _name: &str) -> Result<Option<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn list(&self, _active_only: bool) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn search(&self, _keyword: &str) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn is_member(&self, _team_id: i64, _user_id: i64) -> Result<bool, TeamDomainError> {
        unimplemented!()
    }

    async fn get_member_status(
        &self,
        _team_id: i64,
        _user_id: i64,
    ) -> Result<Option<i8>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members(&self, team_id: i64) -> Result<Vec<TeamMember>, TeamDomainError> {
        Ok(self
            .team_members
            .lock()
            .unwrap()
            .get(&team_id)
            .cloned()
            .unwrap_or_default())
    }

    async fn list_members_for_management(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamMember>, TeamDomainError> {
        self.list_members(team_id).await
    }

    async fn list_member_attendance_records(
        &self,
        _team_id: i64,
        _user_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<TeamMemberAttendanceRecord>, TeamDomainError> {
        Ok(Vec::new())
    }

    async fn list_team_attendance_ranking(
        &self,
        _team_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<TeamAttendanceRankingItem>, TeamDomainError> {
        Ok(Vec::new())
    }

    async fn list_user_teams(&self, _user_id: i64) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members_with_info(
        &self,
        _team_id: i64,
    ) -> Result<Vec<TeamMemberWithInfo>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_team_admins_with_info(
        &self,
        _team_id: i64,
    ) -> Result<Vec<TeamAdminInfo>, TeamDomainError> {
        unimplemented!()
    }

    async fn is_admin_assigned(
        &self,
        team_id: i64,
        admin_id: i64,
    ) -> Result<bool, TeamDomainError> {
        Ok(self
            .admin_assignments
            .lock()
            .unwrap()
            .get(&admin_id)
            .is_some_and(|team_ids| team_ids.contains(&team_id)))
    }

    async fn list_teams_by_admin(&self, admin_id: i64) -> Result<Vec<Team>, TeamDomainError> {
        let team_ids = self
            .admin_assignments
            .lock()
            .unwrap()
            .get(&admin_id)
            .cloned()
            .unwrap_or_default();
        Ok(self
            .teams
            .lock()
            .unwrap()
            .values()
            .filter(|team| team_ids.contains(&team.id))
            .cloned()
            .collect())
    }

    async fn list_credit_transactions(
        &self,
        _team_id: i64,
        _limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, TeamDomainError> {
        Ok(Vec::new())
    }

    async fn find_activity_review(
        &self,
        _activity_id: &str,
        _reviewer_team_id: i64,
    ) -> Result<Option<ActivityTeamReview>, TeamDomainError> {
        Ok(None)
    }
}

#[derive(Default)]
struct FakeNotificationRepository {
    items: Mutex<Vec<Notification>>,
}

#[async_trait]
impl NotificationCommandRepository for FakeNotificationRepository {
    async fn create_many(
        &self,
        notifications: &[Notification],
    ) -> Result<(), NotificationDomainError> {
        self.items
            .lock()
            .unwrap()
            .extend(notifications.iter().cloned());
        Ok(())
    }

    async fn mark_all_read(&self, user_id: i64) -> Result<u64, NotificationDomainError> {
        let mut affected = 0;
        for item in self.items.lock().unwrap().iter_mut() {
            if item.user_id == user_id && item.read_at.is_none() {
                item.read_at = Some(Utc::now().naive_utc());
                affected += 1;
            }
        }
        Ok(affected)
    }
}

#[async_trait]
impl NotificationQueryRepository for FakeNotificationRepository {
    async fn list_for_user(
        &self,
        user_id: i64,
        unread_only: bool,
        limit: i64,
    ) -> Result<Vec<Notification>, NotificationDomainError> {
        let mut items = self
            .items
            .lock()
            .unwrap()
            .iter()
            .filter(|item| item.user_id == user_id)
            .filter(|item| !unread_only || item.read_at.is_none())
            .cloned()
            .collect::<Vec<_>>();
        items.truncate(limit.max(1) as usize);
        Ok(items)
    }

    async fn count_unread(&self, user_id: i64) -> Result<i64, NotificationDomainError> {
        Ok(self
            .items
            .lock()
            .unwrap()
            .iter()
            .filter(|item| item.user_id == user_id && item.read_at.is_none())
            .count() as i64)
    }
}

fn notification_service() -> Arc<NotificationService> {
    let repository = Arc::new(FakeNotificationRepository::default());
    Arc::new(NotificationService::new(repository.clone(), repository))
}

fn user_actor(id: i64) -> ActorContext {
    ActorContext {
        id,
        actor_kind: ActorKind::User,
        is_super_admin: false,
    }
}

fn sample_user(user_id: i64, is_venue: bool) -> User {
    let now = Utc::now().naive_utc();
    User {
        id: user_id,
        open_id: format!("openid-{user_id}"),
        union_id: None,
        username: format!("user-{user_id}"),
        password_hash: None,
        nickname: format!("用户{user_id}"),
        real_name: String::new(),
        avatar_url: String::new(),
        phone_number: String::new(),
        is_manager: 0,
        is_venue: if is_venue { 1 } else { 0 },
        status: 1,
        create_time: now,
        latest_login_date: now,
        leave_start_time: None,
        leave_end_time: None,
    }
}

fn admin_actor(id: i64, is_super_admin: bool) -> ActorContext {
    ActorContext {
        id,
        actor_kind: ActorKind::Admin,
        is_super_admin,
    }
}

fn sample_team(team_id: i64, captain_id: i64, name: &str) -> Team {
    let now = Utc::now().naive_utc();
    Team {
        id: team_id,
        name: name.to_string(),
        description: None,
        logo_url: None,
        captain_id: Some(captain_id),
        join_password_hash: None,
        status: 1,
        credit_score: DEFAULT_TEAM_CREDIT_SCORE,
        vip_until: None,
        created_at: now,
        updated_at: now,
    }
}

fn add_active_member_role(repository: &Arc<FakeTeamStore>, team_id: i64, user_id: i64, role: &str) {
    let now = Utc::now().naive_utc();
    repository
        .team_members
        .lock()
        .unwrap()
        .entry(team_id)
        .or_default()
        .push(TeamMember {
            id: user_id,
            team_id,
            user_id,
            role: role.to_string(),
            jersey_number: None,
            is_member: false,
            joined_at: now,
            status: 1,
            created_at: now,
            updated_at: now,
        });
}

fn sample_challenge(
    challenge_id: &str,
    host_team_id: i64,
    host_user_id: i64,
    holding_date: chrono::NaiveDateTime,
    kind: ChallengeKind,
    players_per_team: i32,
) -> Challenge {
    Challenge {
        id: challenge_id.to_string(),
        title: format!("{challenge_id}-title"),
        kind,
        payment_mode: ChallengePaymentMode::Postpaid,
        host_team_id: Some(host_team_id),
        host_user_id,
        guest_team_id: None,
        accepted_by_user_id: None,
        activity_id: None,
        holding_date,
        start_time: holding_date,
        end_time: holding_date + Duration::hours(2),
        location: "测试球场".to_string(),
        location_latitude: None,
        location_longitude: None,
        players_per_team,
        min_players: None,
        max_players: None,
        fee_per_person: None,
        note: None,
        status: ChallengeStatus::Open,
        accepted_at: None,
        cancelled_at: None,
        created_at: holding_date - Duration::days(1),
        updated_at: holding_date - Duration::days(1),
    }
}

#[tokio::test]
async fn captain_can_create_challenge() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(1, 7, "银河联队")]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository,
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(3);

    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: Some(1),
                host_user_id: None,
                title: "周六夜场 8 人制约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "驿马河二期 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: Some(Decimal::new(2800, 2)),
                note: Some("想约一场强度中高的友谊赛".to_string()),
            },
        )
        .await
        .expect("captain should create challenge");

    assert_eq!(challenge.host_team_id, Some(1));
    assert_eq!(challenge.host_user_id, 7);
    assert_eq!(challenge.status, ChallengeStatus::Open);
}

#[tokio::test]
async fn super_admin_can_cancel_open_challenge() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(1, 7, "银河联队")]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository,
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(3);
    let challenge = sample_challenge("admin-cancel", 1, 7, holding_date, ChallengeKind::Team, 8);
    repository.create(&challenge).await.unwrap();

    let cancelled = service
        .cancel_challenge(&admin_actor(900, true), &challenge.id)
        .await
        .expect("super admin should cancel an open challenge");

    assert_eq!(cancelled.status, ChallengeStatus::Cancelled);
    assert!(cancelled.cancelled_at.is_some());
}

#[tokio::test]
async fn super_admin_can_update_open_challenge_basic_fields() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(1, 7, "银河联队")]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository,
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(3);
    let challenge = sample_challenge("admin-update", 1, 7, holding_date, ChallengeKind::Team, 8);
    repository.create(&challenge).await.unwrap();

    let next_start_time = holding_date + Duration::hours(1);
    let updated = service
        .update_challenge(
            &admin_actor(900, true),
            &challenge.id,
            UpdateChallengeCommand {
                title: "后台调整后的约队".to_string(),
                holding_date: next_start_time,
                start_time: next_start_time,
                end_time: next_start_time + Duration::hours(2),
                location: "后台 2 号场".to_string(),
                location_latitude: Some(30.66),
                location_longitude: Some(104.06),
                players_per_team: 9,
                min_players: None,
                max_players: None,
                fee_per_person: Some(Decimal::new(3200, 2)),
                note: Some("后台补充说明".to_string()),
            },
        )
        .await
        .expect("super admin should update an open challenge");

    assert_eq!(updated.title, "后台调整后的约队");
    assert_eq!(updated.location, "后台 2 号场");
    assert_eq!(updated.start_time, next_start_time);
    assert_eq!(updated.end_time, next_start_time + Duration::hours(2));
    assert_eq!(updated.players_per_team, 9);
    assert_eq!(updated.fee_per_person, Some(Decimal::new(3200, 2)));
    assert_eq!(updated.note.as_deref(), Some("后台补充说明"));
}

#[tokio::test]
async fn super_admin_can_create_individual_challenge_for_host_user() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(Vec::new()));
    let user_repository = Arc::new(FakeUserStore::with_users(vec![sample_user(30, true)]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository,
        user_repository,
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(3);

    let challenge = service
        .create_challenge(
            &admin_actor(900, true),
            CreateChallengeCommand {
                kind: ChallengeKind::Individual,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: Some(30),
                title: "后台创建散人报名".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "后台 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: Some(Decimal::new(2500, 2)),
                note: Some("后台代场馆发布".to_string()),
            },
        )
        .await
        .expect("super admin should create individual challenge for a user");

    assert_eq!(challenge.kind, ChallengeKind::Individual);
    assert_eq!(challenge.host_team_id, None);
    assert_eq!(challenge.host_user_id, 30);
    assert_eq!(challenge.status, ChallengeStatus::Open);
}

#[tokio::test]
async fn non_super_admin_cannot_create_individual_challenge_from_backend() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(Vec::new()));
    let user_repository = Arc::new(FakeUserStore::with_users(vec![sample_user(30, true)]));
    let service = ChallengeService::new(
        repository.clone(),
        repository,
        team_repository,
        user_repository,
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(3);

    let error = service
        .create_challenge(
            &admin_actor(901, false),
            CreateChallengeCommand {
                kind: ChallengeKind::Individual,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: Some(30),
                title: "后台创建散人报名".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "后台 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect_err("non-super admin should not create backend individual challenge");

    assert!(matches!(
        error,
        registration_system_backend::shared::error::AppError::Forbidden
    ));
}

#[tokio::test]
async fn super_admin_backend_create_rejects_team_challenge_kind() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(Vec::new()));
    let user_repository = Arc::new(FakeUserStore::with_users(vec![sample_user(30, true)]));
    let service = ChallengeService::new(
        repository.clone(),
        repository,
        team_repository,
        user_repository,
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(3);

    let error = service
        .create_challenge(
            &admin_actor(900, true),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: Some(30),
                title: "后台误建球队约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "后台 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect_err("backend challenge create should be individual only");

    assert!(matches!(
        error,
        registration_system_backend::shared::error::AppError::Validation(_)
    ));
}

#[tokio::test]
async fn leader_can_create_team_challenge() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(1, 7, "银河联队")]));
    add_active_member_role(&team_repository, 1, 18, "leader");
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository,
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(3);

    let challenge = service
        .create_challenge(
            &user_actor(18),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: Some(1),
                host_user_id: None,
                title: "领队发起的球队约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "驿马河二期 2 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect("leader should create team challenge");

    assert_eq!(challenge.kind, ChallengeKind::Team);
    assert_eq!(challenge.host_user_id, 18);
}

#[tokio::test]
async fn venue_user_can_create_team_challenge_without_host_team_and_still_join_individual_challenge()
 {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(2, 8, "柏林二队")]));
    let user_repository = Arc::new(FakeUserStore::with_users(vec![sample_user(30, true)]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository,
        user_repository,
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(3);

    let challenge = service
        .create_challenge(
            &user_actor(30),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: None,
                title: "场馆组织球队约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "城东足球公园 3 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: Some(Decimal::new(3000, 2)),
                note: Some("场馆提供裁判和水".to_string()),
            },
        )
        .await
        .expect("venue user should create challenge without team");

    assert_eq!(challenge.host_team_id, None);
    assert_eq!(challenge.host_user_id, 30);

    let individual = sample_challenge(
        "venue-can-join-individual",
        2,
        8,
        holding_date + Duration::days(1),
        ChallengeKind::Individual,
        8,
    );
    repository
        .create(&individual)
        .await
        .expect("individual challenge should seed");

    let accepted = service
        .accept_challenge(
            &user_actor(30),
            "venue-can-join-individual",
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect("venue identity should not block player signup");

    assert_eq!(accepted.kind, ChallengeKind::Individual);
}

#[tokio::test]
async fn regular_user_cannot_create_challenge_without_host_team() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![]));
    let user_repository = Arc::new(FakeUserStore::with_users(vec![sample_user(31, false)]));
    let service = ChallengeService::new(
        repository.clone(),
        repository,
        team_repository,
        user_repository,
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(3);

    let error = service
        .create_challenge(
            &user_actor(31),
            CreateChallengeCommand {
                kind: ChallengeKind::Individual,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: None,
                title: "普通用户散人约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "城东足球公园 3 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect_err("regular user should not create venue challenge");

    assert!(matches!(
        error,
        registration_system_backend::shared::error::AppError::Forbidden
    ));
}

#[tokio::test]
async fn accepting_challenge_marks_it_matched_and_generates_activity() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![
        sample_team(1, 7, "银河联队"),
        sample_team(2, 8, "柏林二队"),
    ]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository,
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: Some(1),
                host_user_id: None,
                title: "工作日晚场 6 人制".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "府河绿道足球场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 6,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect("challenge should be created");

    let matched = service
        .accept_challenge(
            &user_actor(8),
            &challenge.id,
            AcceptChallengeCommand {
                guest_team_id: Some(2),
            },
        )
        .await
        .expect("challenge should be accepted");

    assert_eq!(matched.status, ChallengeStatus::Matched);
    assert_eq!(matched.guest_team_id, Some(2));
    assert!(matched.activity_id.is_some());

    let created_activity = repository.created_activity.lock().unwrap().clone();
    let created_activity = created_activity.expect("activity should be created");
    assert_eq!(created_activity.home_team_id, Some(1));
    assert_eq!(created_activity.away_team_id, Some(2));
    assert_eq!(created_activity.players_per_team, Some(6));
}

#[tokio::test]
async fn venue_team_challenge_creates_pending_activity_then_second_team_confirms_opponent() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![
        sample_team(2, 8, "柏林二队"),
        sample_team(3, 9, "河西周四 FC"),
    ]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository,
        Arc::new(FakeUserStore::with_users(vec![sample_user(30, true)])),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    let challenge = service
        .create_challenge(
            &user_actor(30),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: None,
                title: "场馆撮合球队约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "城东足球公园 3 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: Some(Decimal::new(3000, 2)),
                note: None,
            },
        )
        .await
        .expect("venue should create team challenge");

    let first_team_joined = service
        .accept_challenge(
            &user_actor(8),
            &challenge.id,
            AcceptChallengeCommand {
                guest_team_id: Some(2),
            },
        )
        .await
        .expect("first team should reserve the venue challenge");

    assert_eq!(first_team_joined.status, ChallengeStatus::Open);
    assert_eq!(first_team_joined.host_team_id, Some(2));
    assert_eq!(first_team_joined.guest_team_id, None);
    assert!(first_team_joined.activity_id.is_some());
    let pending_activity = repository.created_activity.lock().unwrap().clone();
    let pending_activity = pending_activity.expect("pending activity should be created");
    assert_eq!(pending_activity.home_team_id, Some(2));
    assert_eq!(pending_activity.away_team_id, None);
    assert_eq!(pending_activity.opposing.as_deref(), Some("等待对手"));

    let matched = service
        .accept_challenge(
            &user_actor(9),
            &challenge.id,
            AcceptChallengeCommand {
                guest_team_id: Some(3),
            },
        )
        .await
        .expect("second team should match the venue challenge");

    assert_eq!(matched.status, ChallengeStatus::Matched);
    assert_eq!(matched.host_team_id, Some(2));
    assert_eq!(matched.guest_team_id, Some(3));
    assert!(matched.activity_id.is_some());
    assert_eq!(matched.activity_id, first_team_joined.activity_id);

    let created_activity = repository.created_activity.lock().unwrap().clone();
    let created_activity = created_activity.expect("activity should be created after second team");
    assert_eq!(created_activity.home_team_id, Some(2));
    assert_eq!(created_activity.away_team_id, Some(3));
    assert_eq!(
        created_activity.opposing.as_deref(),
        Some("柏林二队 vs 河西周四 FC"),
    );
}

#[tokio::test]
async fn leader_can_accept_team_challenge_for_current_team() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![
        sample_team(1, 7, "银河联队"),
        sample_team(2, 8, "柏林二队"),
    ]));
    add_active_member_role(&team_repository, 2, 18, "leader");
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository.clone(),
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    repository
        .create(&sample_challenge(
            "challenge-team-leader",
            1,
            7,
            holding_date,
            ChallengeKind::Team,
            8,
        ))
        .await
        .expect("challenge should seed");

    let accepted = service
        .accept_challenge(
            &user_actor(18),
            "challenge-team-leader",
            AcceptChallengeCommand {
                guest_team_id: Some(2),
            },
        )
        .await
        .expect("leader should accept team challenge");

    assert_eq!(accepted.guest_team_id, Some(2));
    assert_eq!(accepted.accepted_by_user_id, Some(18));
    assert_eq!(accepted.status, ChallengeStatus::Matched);
}

#[tokio::test]
async fn individual_challenge_accepts_users_until_capacity_is_full() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(1, 7, "银河联队")]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository.clone(),
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    repository
        .create(&sample_challenge(
            "challenge-individual-open",
            1,
            7,
            holding_date,
            ChallengeKind::Individual,
            2,
        ))
        .await
        .expect("challenge should seed");

    let mut accepted = None;
    for user_id in 21..=24 {
        accepted = Some(
            service
                .accept_challenge(
                    &user_actor(user_id),
                    "challenge-individual-open",
                    AcceptChallengeCommand {
                        guest_team_id: None,
                    },
                )
                .await
                .expect("user should join individual challenge before min players"),
        );
    }
    let accepted = accepted.expect("challenge should have accepted users");

    assert_eq!(accepted.kind, ChallengeKind::Individual);
    assert_eq!(accepted.players_per_team, 2);
    assert_eq!(accepted.status, ChallengeStatus::Matched);
}

#[tokio::test]
async fn individual_challenge_uses_custom_min_and_max_players() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(1, 7, "银河联队")]));
    let user_repository = Arc::new(FakeUserStore::with_users(vec![sample_user(30, true)]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository,
        user_repository,
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    let challenge = service
        .create_challenge(
            &user_actor(30),
            CreateChallengeCommand {
                kind: ChallengeKind::Individual,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: None,
                title: "10人成行14人封顶".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "测试球场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 5,
                min_players: Some(10),
                max_players: Some(14),
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect("venue should create individual challenge with custom limits");

    assert_eq!(challenge.min_players, Some(10));
    assert_eq!(challenge.max_players, Some(14));
    assert_eq!(challenge.min_signup_players(), 10);
    assert_eq!(challenge.max_signup_players(), 14);

    let mut accepted = None;
    for user_id in 100..=109 {
        accepted = Some(
            service
                .accept_challenge(
                    &user_actor(user_id),
                    &challenge.id,
                    AcceptChallengeCommand {
                        guest_team_id: None,
                    },
                )
                .await
                .expect("users before custom min should join"),
        );
    }
    assert_eq!(
        accepted.expect("tenth user should be accepted").status,
        ChallengeStatus::Matched
    );

    for user_id in 110..=113 {
        service
            .accept_challenge(
                &user_actor(user_id),
                &challenge.id,
                AcceptChallengeCommand {
                    guest_team_id: None,
                },
            )
            .await
            .expect("users before custom max should join");
    }

    let error = service
        .accept_challenge(
            &user_actor(114),
            &challenge.id,
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect_err("fifteenth user should be rejected by custom max");

    assert!(matches!(
        error,
        registration_system_backend::shared::error::AppError::Conflict(_)
    ));
}

#[tokio::test]
async fn individual_challenge_rejects_accept_when_default_max_players_is_full() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(1, 7, "银河联队")]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository.clone(),
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    repository
        .create(&sample_challenge(
            "challenge-individual-full",
            1,
            7,
            holding_date,
            ChallengeKind::Individual,
            1,
        ))
        .await
        .expect("challenge should seed");

    for user_id in 21..=26 {
        service
            .accept_challenge(
                &user_actor(user_id),
                "challenge-individual-full",
                AcceptChallengeCommand {
                    guest_team_id: None,
                },
            )
            .await
            .expect("users before default max should join");
    }

    let error = service
        .accept_challenge(
            &user_actor(27),
            "challenge-individual-full",
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect_err("seventh user should be rejected by default max");

    assert!(matches!(
        error,
        registration_system_backend::shared::error::AppError::Conflict(_)
    ));
}

#[tokio::test]
async fn user_cannot_accept_two_overlapping_individual_challenges() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(1, 7, "银河联队")]));
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        team_repository.clone(),
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    repository
        .create(&sample_challenge(
            "challenge-individual-first",
            1,
            7,
            holding_date,
            ChallengeKind::Individual,
            10,
        ))
        .await
        .expect("first challenge should seed");
    repository
        .create(&sample_challenge(
            "challenge-individual-second",
            1,
            7,
            holding_date + Duration::minutes(30),
            ChallengeKind::Individual,
            10,
        ))
        .await
        .expect("second challenge should seed");

    service
        .accept_challenge(
            &user_actor(21),
            "challenge-individual-first",
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect("first individual challenge should be accepted");

    let error = service
        .accept_challenge(
            &user_actor(21),
            "challenge-individual-second",
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect_err("overlapping individual challenge should be rejected");

    assert!(matches!(
        error,
        registration_system_backend::shared::error::AppError::Conflict(_)
    ));
}

#[tokio::test]
async fn team_cannot_accept_its_own_challenge() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(1, 7, "银河联队")]));
    let service = ChallengeService::new(
        repository.clone(),
        repository,
        team_repository,
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(1);

    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: Some(1),
                host_user_id: None,
                title: "周二练习赛".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "东湖公园 5 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 5,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect("challenge should be created");

    let error = service
        .accept_challenge(
            &user_actor(7),
            &challenge.id,
            AcceptChallengeCommand {
                guest_team_id: Some(1),
            },
        )
        .await
        .expect_err("same team should not accept its own challenge");

    assert!(error.to_string().contains("不能接自己发布的约队"));
}

#[tokio::test]
async fn admin_can_list_challenges_across_managed_teams() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![
        sample_team(1, 7, "银河联队"),
        sample_team(2, 8, "柏林二队"),
    ]));
    let service = ChallengeService::new(
        repository.clone(),
        repository,
        team_repository,
        Arc::new(FakeUserStore::default()),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: Some(1),
                host_user_id: None,
                title: "A 队周末约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "主城 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect("team-a challenge should be created");

    service
        .create_challenge(
            &user_actor(8),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: Some(2),
                host_user_id: None,
                title: "B 队夜场约队".to_string(),
                holding_date: holding_date + Duration::days(1),
                start_time: holding_date + Duration::days(1),
                end_time: holding_date + Duration::days(1) + Duration::hours(2),
                location: "主城 2 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 6,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect("team-b challenge should be created");

    let items = service
        .list_for_admin(
            &admin_actor(900, true),
            AdminChallengeListQuery {
                team_id: None,
                keyword: None,
                status: None,
                kind: None,
                include_closed: false,
                limit: 50,
                sort: "holding_date_asc".to_string(),
            },
        )
        .await
        .expect("super admin should list all challenges");

    assert_eq!(items.len(), 2);
}

#[tokio::test]
async fn admin_can_filter_individual_challenges() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamStore::new(vec![sample_team(2, 8, "柏林二队")]));
    let service = ChallengeService::new(
        repository.clone(),
        repository,
        team_repository,
        Arc::new(FakeUserStore::with_users(vec![sample_user(7, true)])),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Individual,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: None,
                title: "散人晚场".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "主城 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect("individual challenge should be created");

    service
        .create_challenge(
            &user_actor(8),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: Some(2),
                host_user_id: None,
                title: "球队约队".to_string(),
                holding_date: holding_date + Duration::days(1),
                start_time: holding_date + Duration::days(1),
                end_time: holding_date + Duration::days(1) + Duration::hours(2),
                location: "主城 2 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: None,
                note: None,
            },
        )
        .await
        .expect("team challenge should be created");

    let items = service
        .list_for_admin(
            &admin_actor(900, true),
            AdminChallengeListQuery {
                team_id: None,
                keyword: None,
                status: None,
                kind: Some(ChallengeKind::Individual),
                include_closed: false,
                limit: 50,
                sort: "holding_date_asc".to_string(),
            },
        )
        .await
        .expect("super admin should list individual challenges");

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].challenge.kind, ChallengeKind::Individual);
    assert_eq!(items[0].challenge.title, "散人晚场");
}

#[tokio::test]
async fn prepaid_individual_acceptance_gets_payment_deadline() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(FakeTeamStore::new(Vec::new())),
        Arc::new(FakeUserStore::with_users(vec![sample_user(7, true)])),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::hours(3);
    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Individual,
                payment_mode: ChallengePaymentMode::Prepaid,
                host_team_id: None,
                host_user_id: None,
                title: "赛前支付散人局".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "主城 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: Some(Decimal::new(2500, 2)),
                note: None,
            },
        )
        .await
        .expect("prepaid challenge should be created");

    service
        .accept_challenge(
            &user_actor(42),
            &challenge.id,
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect("user should join prepaid individual challenge");

    let detail = service
        .get_detail(&user_actor(42), &challenge.id)
        .await
        .unwrap()
        .unwrap();
    let acceptance = detail
        .current_user_acceptance
        .expect("current user acceptance should be returned");

    assert_eq!(
        acceptance.payment_status,
        IndividualAcceptancePaymentStatus::Unpaid
    );
    let deadline = acceptance
        .payment_deadline_at
        .expect("prepaid challenge should get payment deadline");
    let distance = deadline - Utc::now().naive_utc();
    assert!(distance <= Duration::minutes(20));
    assert!(distance > Duration::minutes(18));
}

#[tokio::test]
async fn postpaid_individual_acceptance_has_no_payment_deadline() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(FakeTeamStore::new(Vec::new())),
        Arc::new(FakeUserStore::with_users(vec![sample_user(7, true)])),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::hours(3);
    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Individual,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: None,
                title: "赛后支付散人局".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "主城 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: Some(Decimal::new(2500, 2)),
                note: None,
            },
        )
        .await
        .expect("postpaid challenge should be created");

    service
        .accept_challenge(
            &user_actor(42),
            &challenge.id,
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect("user should join postpaid individual challenge");

    let detail = service
        .get_detail(&user_actor(42), &challenge.id)
        .await
        .unwrap()
        .unwrap();
    let acceptance = detail
        .current_user_acceptance
        .expect("current user acceptance should be returned");

    assert_eq!(
        acceptance.payment_status,
        IndividualAcceptancePaymentStatus::Unpaid
    );
    assert_eq!(acceptance.payment_deadline_at, None);
}

#[tokio::test]
async fn process_individual_payments_cancels_expired_prepaid_acceptance() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(FakeTeamStore::new(Vec::new())),
        Arc::new(FakeUserStore::with_users(vec![sample_user(7, true)])),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::minutes(10);
    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Individual,
                payment_mode: ChallengePaymentMode::Prepaid,
                host_team_id: None,
                host_user_id: None,
                title: "即将开赛散人局".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "主城 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: Some(Decimal::new(2500, 2)),
                note: None,
            },
        )
        .await
        .unwrap();

    service
        .accept_challenge(
            &user_actor(42),
            &challenge.id,
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .unwrap();

    let result = service
        .process_individual_payments(holding_date + Duration::seconds(1))
        .await
        .unwrap();

    assert_eq!(result.cancelled_count, 1);
    let detail = service
        .get_detail(&user_actor(42), &challenge.id)
        .await
        .unwrap()
        .unwrap();
    assert!(!detail.summary.current_user_joined);
    assert!(detail.current_user_acceptance.is_none());
}

#[tokio::test]
async fn process_individual_payments_notifies_postpaid_unpaid_once() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let notification_repository = Arc::new(FakeNotificationRepository::default());
    let service = ChallengeService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(FakeTeamStore::new(Vec::new())),
        Arc::new(FakeUserStore::with_users(vec![sample_user(7, true)])),
        Arc::new(NotificationService::new(
            notification_repository.clone(),
            notification_repository.clone(),
        )),
    );
    let holding_date = Utc::now().naive_utc() - Duration::hours(3);
    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Individual,
                payment_mode: ChallengePaymentMode::Postpaid,
                host_team_id: None,
                host_user_id: None,
                title: "已结束散人局".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "主城 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                min_players: None,
                max_players: None,
                fee_per_person: Some(Decimal::new(2500, 2)),
                note: None,
            },
        )
        .await
        .unwrap();

    service
        .accept_challenge(
            &user_actor(42),
            &challenge.id,
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .unwrap();

    let first = service
        .process_individual_payments(Utc::now().naive_utc())
        .await
        .unwrap();
    let second = service
        .process_individual_payments(Utc::now().naive_utc() + Duration::minutes(1))
        .await
        .unwrap();

    assert_eq!(first.notified_count, 1);
    assert_eq!(second.notified_count, 0);
    let notifications = notification_repository.items.lock().unwrap();
    let due_notifications = notifications
        .iter()
        .filter(|item| item.kind == "challenge_payment_due" && item.user_id == 42)
        .collect::<Vec<_>>();
    assert_eq!(due_notifications.len(), 1);
    assert!(due_notifications[0].content.contains("已结束散人局"));
}
