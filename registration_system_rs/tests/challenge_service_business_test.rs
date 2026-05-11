use async_trait::async_trait;
use chrono::{Duration, Utc};
use registration_system_backend::activity::domain::Activity;
use registration_system_backend::challenge::application::{
    AcceptChallengeCommand, AdminChallengeListQuery, ChallengeService, CreateChallengeCommand,
};
use registration_system_backend::challenge::domain::{
    Challenge, ChallengeDetail, ChallengeKind, ChallengeStatus, ChallengeSummary, DomainError,
};
use registration_system_backend::challenge::ports::{
    AdminChallengeRepositoryQuery, ChallengeRepository, TeamChallengeListQuery,
};
use registration_system_backend::notification::application::NotificationService;
use registration_system_backend::notification::domain::{
    DomainError as NotificationDomainError, Notification,
};
use registration_system_backend::notification::ports::NotificationRepository;
use registration_system_backend::shared::auth::{ActorContext, ActorKind};
use registration_system_backend::team::domain::{
    ActivityTeamReview, DEFAULT_TEAM_CREDIT_SCORE, DomainError as TeamDomainError, Team,
    TeamAdminInfo, TeamCreditTransaction, TeamMember, TeamMemberAttendanceRecord,
    TeamMemberWithInfo, UpdateTeamFields,
};
use registration_system_backend::team::ports::{
    ActivityReviewRecord, MembershipRechargeRecord, TeamRepository,
};
use rust_decimal::Decimal;
use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct FakeChallengeRepository {
    challenges: Mutex<HashMap<String, Challenge>>,
    created_activity: Mutex<Option<Activity>>,
    individual_acceptances: Mutex<HashMap<String, BTreeSet<i64>>>,
}

#[async_trait]
impl ChallengeRepository for FakeChallengeRepository {
    async fn create(&self, challenge: &Challenge) -> Result<(), DomainError> {
        self.challenges
            .lock()
            .unwrap()
            .insert(challenge.id.clone(), challenge.clone());
        Ok(())
    }

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
            .filter(|challenge| {
                challenge.status == ChallengeStatus::Open
                    || challenge.host_team_id == query.team_id
                    || challenge.guest_team_id.as_deref() == Some(query.team_id)
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
                        if challenge.host_team_id == query.team_id {
                            "host"
                        } else if challenge.guest_team_id.as_deref() == Some(query.team_id) {
                            "guest"
                        } else {
                            "viewer"
                        }
                        .to_string(),
                    ),
                    accepted_count,
                    current_user_joined,
                    can_accept: challenge.status == ChallengeStatus::Open
                        && challenge.host_team_id != query.team_id,
                    host_team_name: challenge.host_team_id.clone(),
                    host_team_credit_score: 90,
                    host_team_trust_label: "稳定赴约".to_string(),
                    guest_team_name: challenge.guest_team_id.clone(),
                    guest_team_credit_score: Some(85),
                    guest_team_trust_label: Some("稳定赴约".to_string()),
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
            .filter(|challenge| {
                query.team_id.is_none_or(|expected| {
                    challenge.host_team_id == expected
                        || challenge.guest_team_id.as_deref() == Some(expected)
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
            .map(|challenge| ChallengeSummary {
                host_team_name: challenge.host_team_id.clone(),
                host_team_credit_score: 90,
                host_team_trust_label: "稳定赴约".to_string(),
                guest_team_name: challenge.guest_team_id.clone(),
                guest_team_credit_score: Some(85),
                guest_team_trust_label: Some("稳定赴约".to_string()),
                current_team_relation: None,
                accepted_count: self
                    .individual_acceptances
                    .lock()
                    .unwrap()
                    .get(&challenge.id)
                    .map(|items| items.len() as i32)
                    .unwrap_or(0),
                current_user_joined: false,
                can_accept: false,
                challenge,
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
                    },
                    activity: None,
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

    async fn accept_with_activity(
        &self,
        challenge_id: &str,
        guest_team_id: &str,
        accepted_by_user_id: i64,
        activity: &Activity,
    ) -> Result<Challenge, DomainError> {
        let mut items = self.challenges.lock().unwrap();
        let challenge = items
            .get_mut(challenge_id)
            .ok_or_else(|| DomainError::NotFound("challenge not found".to_string()))?;
        challenge.status = ChallengeStatus::Matched;
        challenge.guest_team_id = Some(guest_team_id.to_string());
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
        challenge_id: &str,
        user_id: i64,
    ) -> Result<Challenge, DomainError> {
        let mut acceptances = self.individual_acceptances.lock().unwrap();
        let accepted_users = acceptances.entry(challenge_id.to_string()).or_default();

        if !accepted_users.insert(user_id) {
            return Err(DomainError::Conflict("你已接过这场散人约队".to_string()));
        }

        let accepted_count = accepted_users.len() as i32;
        drop(acceptances);

        let mut items = self.challenges.lock().unwrap();
        let challenge = items
            .get_mut(challenge_id)
            .ok_or_else(|| DomainError::NotFound("challenge not found".to_string()))?;
        if accepted_count >= challenge.players_per_team {
            challenge.status = ChallengeStatus::Matched;
            challenge.accepted_at = Some(Utc::now().naive_utc());
        }
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
}

#[tokio::test]
async fn public_challenge_list_does_not_require_current_user_or_team() {
    let challenge_repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamRepository::new(vec![]));
    let notification_repository = Arc::new(FakeNotificationRepository::default());
    let service = ChallengeService::new(
        challenge_repository.clone(),
        team_repository,
        Arc::new(NotificationService::new(notification_repository)),
    );
    let now = Utc::now().naive_utc();
    let open_challenge = Challenge {
        id: "public-open".to_string(),
        title: "公开约队".to_string(),
        kind: ChallengeKind::Team,
        host_team_id: "team-a".to_string(),
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
        .list_public(None, None, false, 20, "holding_date_asc")
        .await
        .unwrap();

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].challenge.id, "public-open");
    assert_eq!(items[0].current_team_relation, None);
    assert!(!items[0].can_accept);
}

struct FakeTeamRepository {
    teams: Mutex<HashMap<String, Team>>,
    team_members: Mutex<HashMap<String, Vec<TeamMember>>>,
    admin_assignments: Mutex<HashMap<i64, BTreeSet<String>>>,
}

impl FakeTeamRepository {
    fn new(teams: Vec<Team>) -> Self {
        let now = Utc::now().naive_utc();
        let mut team_members = HashMap::new();
        for team in &teams {
            if let Some(captain_id) = team.captain_id {
                team_members.insert(
                    team.id.clone(),
                    vec![TeamMember {
                        id: captain_id,
                        team_id: team.id.clone(),
                        user_id: captain_id,
                        role: "captain".to_string(),
                        jersey_number: None,
                        joined_at: now,
                        status: 1,
                        created_at: now,
                        updated_at: now,
                    }],
                );
            }
        }

        Self {
            teams: Mutex::new(
                teams
                    .into_iter()
                    .map(|team| (team.id.clone(), team))
                    .collect(),
            ),
            team_members: Mutex::new(team_members),
            admin_assignments: Mutex::new(HashMap::new()),
        }
    }
}

#[async_trait]
impl TeamRepository for FakeTeamRepository {
    async fn create(&self, _team: &Team) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn find_by_id(&self, team_id: &str) -> Result<Option<Team>, TeamDomainError> {
        Ok(self.teams.lock().unwrap().get(team_id).cloned())
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

    async fn update(
        &self,
        _team_id: &str,
        _fields: UpdateTeamFields<'_>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn delete(&self, _team_id: &str) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn add_member(
        &self,
        _team_id: &str,
        _user_id: i64,
        _role: &str,
        _jersey_number: Option<&str>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn reactivate_member(
        &self,
        _team_id: &str,
        _user_id: i64,
        _role: &str,
        _jersey_number: Option<&str>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn remove_member(&self, _team_id: &str, _user_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn batch_remove_members(
        &self,
        _team_id: &str,
        _user_ids: &[i64],
    ) -> Result<u64, TeamDomainError> {
        unimplemented!()
    }

    async fn update_member(
        &self,
        _team_id: &str,
        _user_id: i64,
        _role: Option<&str>,
        _jersey_number: Option<Option<&str>>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn batch_update_member_status(
        &self,
        _team_id: &str,
        _user_ids: &[i64],
        _status: i8,
    ) -> Result<u64, TeamDomainError> {
        unimplemented!()
    }

    async fn is_member(&self, _team_id: &str, _user_id: i64) -> Result<bool, TeamDomainError> {
        unimplemented!()
    }

    async fn get_member_status(
        &self,
        _team_id: &str,
        _user_id: i64,
    ) -> Result<Option<i8>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members(&self, team_id: &str) -> Result<Vec<TeamMember>, TeamDomainError> {
        Ok(self
            .team_members
            .lock()
            .unwrap()
            .get(team_id)
            .cloned()
            .unwrap_or_default())
    }

    async fn list_members_for_management(
        &self,
        team_id: &str,
    ) -> Result<Vec<TeamMember>, TeamDomainError> {
        self.list_members(team_id).await
    }

    async fn list_member_attendance_records(
        &self,
        _team_id: &str,
        _user_id: i64,
    ) -> Result<Vec<TeamMemberAttendanceRecord>, TeamDomainError> {
        Ok(Vec::new())
    }

    async fn list_user_teams(&self, _user_id: i64) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
    }

    async fn list_members_with_info(
        &self,
        _team_id: &str,
    ) -> Result<Vec<TeamMemberWithInfo>, TeamDomainError> {
        unimplemented!()
    }

    async fn assign_admin(&self, team_id: &str, admin_id: i64) -> Result<(), TeamDomainError> {
        self.admin_assignments
            .lock()
            .unwrap()
            .entry(admin_id)
            .or_default()
            .insert(team_id.to_string());
        Ok(())
    }

    async fn unassign_admin(&self, team_id: &str, admin_id: i64) -> Result<(), TeamDomainError> {
        if let Some(team_ids) = self.admin_assignments.lock().unwrap().get_mut(&admin_id) {
            team_ids.remove(team_id);
        }
        Ok(())
    }

    async fn list_team_admins_with_info(
        &self,
        _team_id: &str,
    ) -> Result<Vec<TeamAdminInfo>, TeamDomainError> {
        unimplemented!()
    }

    async fn is_admin_assigned(
        &self,
        team_id: &str,
        admin_id: i64,
    ) -> Result<bool, TeamDomainError> {
        Ok(self
            .admin_assignments
            .lock()
            .unwrap()
            .get(&admin_id)
            .is_some_and(|team_ids| team_ids.contains(team_id)))
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
        _team_id: &str,
        _limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, TeamDomainError> {
        Ok(Vec::new())
    }

    async fn find_activity_review(
        &self,
        _activity_id: &str,
        _reviewer_team_id: &str,
    ) -> Result<Option<ActivityTeamReview>, TeamDomainError> {
        Ok(None)
    }

    async fn record_activity_review(
        &self,
        _record: ActivityReviewRecord<'_>,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }

    async fn record_membership_recharge(
        &self,
        _record: MembershipRechargeRecord<'_>,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }

    async fn record_credit_penalty(
        &self,
        _team_id: &str,
        _admin_id: i64,
        _points: i32,
        _reason: &str,
        _score_before: i32,
        _score_after: i32,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }
}

#[derive(Default)]
struct FakeNotificationRepository {
    items: Mutex<Vec<Notification>>,
}

#[async_trait]
impl NotificationRepository for FakeNotificationRepository {
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

fn notification_service() -> Arc<NotificationService> {
    Arc::new(NotificationService::new(Arc::new(
        FakeNotificationRepository::default(),
    )))
}

fn user_actor(id: i64) -> ActorContext {
    ActorContext {
        id,
        actor_kind: ActorKind::User,
        is_super_admin: false,
    }
}

fn admin_actor(id: i64, is_super_admin: bool) -> ActorContext {
    ActorContext {
        id,
        actor_kind: ActorKind::Admin,
        is_super_admin,
    }
}

fn sample_team(team_id: &str, captain_id: i64, name: &str) -> Team {
    let now = Utc::now().naive_utc();
    Team {
        id: team_id.to_string(),
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

fn add_active_member_role(
    repository: &Arc<FakeTeamRepository>,
    team_id: &str,
    user_id: i64,
    role: &str,
) {
    let now = Utc::now().naive_utc();
    repository
        .team_members
        .lock()
        .unwrap()
        .entry(team_id.to_string())
        .or_default()
        .push(TeamMember {
            id: user_id,
            team_id: team_id.to_string(),
            user_id,
            role: role.to_string(),
            jersey_number: None,
            joined_at: now,
            status: 1,
            created_at: now,
            updated_at: now,
        });
}

fn sample_challenge(
    challenge_id: &str,
    host_team_id: &str,
    host_user_id: i64,
    holding_date: chrono::NaiveDateTime,
    kind: ChallengeKind,
    players_per_team: i32,
) -> Challenge {
    Challenge {
        id: challenge_id.to_string(),
        title: format!("{challenge_id}-title"),
        kind,
        host_team_id: host_team_id.to_string(),
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
    let team_repository = Arc::new(FakeTeamRepository::new(vec![sample_team(
        "team-a",
        7,
        "银河联队",
    )]));
    let service =
        ChallengeService::new(repository.clone(), team_repository, notification_service());
    let holding_date = Utc::now().naive_utc() + Duration::days(3);

    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                host_team_id: "team-a".to_string(),
                title: "周六夜场 8 人制约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "驿马河二期 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
                fee_per_person: Some(Decimal::new(2800, 2)),
                note: Some("想约一场强度中高的友谊赛".to_string()),
            },
        )
        .await
        .expect("captain should create challenge");

    assert_eq!(challenge.host_team_id, "team-a");
    assert_eq!(challenge.host_user_id, 7);
    assert_eq!(challenge.status, ChallengeStatus::Open);
}

#[tokio::test]
async fn leader_can_create_team_challenge() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamRepository::new(vec![sample_team(
        "team-a",
        7,
        "银河联队",
    )]));
    add_active_member_role(&team_repository, "team-a", 18, "leader");
    let service =
        ChallengeService::new(repository.clone(), team_repository, notification_service());
    let holding_date = Utc::now().naive_utc() + Duration::days(3);

    let challenge = service
        .create_challenge(
            &user_actor(18),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                host_team_id: "team-a".to_string(),
                title: "领队发起的球队约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "驿马河二期 2 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
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
async fn accepting_challenge_marks_it_matched_and_generates_activity() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamRepository::new(vec![
        sample_team("team-a", 7, "银河联队"),
        sample_team("team-b", 8, "柏林二队"),
    ]));
    let service =
        ChallengeService::new(repository.clone(), team_repository, notification_service());
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                host_team_id: "team-a".to_string(),
                title: "工作日晚场 6 人制".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "府河绿道足球场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 6,
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
                guest_team_id: Some("team-b".to_string()),
            },
        )
        .await
        .expect("challenge should be accepted");

    assert_eq!(matched.status, ChallengeStatus::Matched);
    assert_eq!(matched.guest_team_id.as_deref(), Some("team-b"));
    assert!(matched.activity_id.is_some());

    let created_activity = repository.created_activity.lock().unwrap().clone();
    let created_activity = created_activity.expect("activity should be created");
    assert_eq!(created_activity.home_team_id.as_deref(), Some("team-a"));
    assert_eq!(created_activity.away_team_id.as_deref(), Some("team-b"));
    assert_eq!(created_activity.players_per_team, Some(6));
}

#[tokio::test]
async fn leader_can_accept_team_challenge_for_current_team() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamRepository::new(vec![
        sample_team("team-a", 7, "银河联队"),
        sample_team("team-b", 8, "柏林二队"),
    ]));
    add_active_member_role(&team_repository, "team-b", 18, "leader");
    let service = ChallengeService::new(
        repository.clone(),
        team_repository.clone(),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    repository
        .create(&sample_challenge(
            "challenge-team-leader",
            "team-a",
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
                guest_team_id: Some("team-b".to_string()),
            },
        )
        .await
        .expect("leader should accept team challenge");

    assert_eq!(accepted.guest_team_id.as_deref(), Some("team-b"));
    assert_eq!(accepted.accepted_by_user_id, Some(18));
    assert_eq!(accepted.status, ChallengeStatus::Matched);
}

#[tokio::test]
async fn individual_challenge_accepts_users_until_capacity_is_full() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamRepository::new(vec![sample_team(
        "team-a",
        7,
        "银河联队",
    )]));
    let service = ChallengeService::new(
        repository.clone(),
        team_repository.clone(),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    repository
        .create(&sample_challenge(
            "challenge-individual-open",
            "team-a",
            7,
            holding_date,
            ChallengeKind::Individual,
            2,
        ))
        .await
        .expect("challenge should seed");

    service
        .accept_challenge(
            &user_actor(21),
            "challenge-individual-open",
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect("first user should join individual challenge");
    let accepted = service
        .accept_challenge(
            &user_actor(22),
            "challenge-individual-open",
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect("second user should fill remaining slot");

    assert_eq!(accepted.kind, ChallengeKind::Individual);
    assert_eq!(accepted.players_per_team, 2);
    assert_eq!(accepted.status, ChallengeStatus::Matched);
}

#[tokio::test]
async fn individual_challenge_rejects_accept_when_capacity_is_full() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamRepository::new(vec![sample_team(
        "team-a",
        7,
        "银河联队",
    )]));
    let service = ChallengeService::new(
        repository.clone(),
        team_repository.clone(),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    repository
        .create(&sample_challenge(
            "challenge-individual-full",
            "team-a",
            7,
            holding_date,
            ChallengeKind::Individual,
            1,
        ))
        .await
        .expect("challenge should seed");

    service
        .accept_challenge(
            &user_actor(21),
            "challenge-individual-full",
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect("first user should join");

    let error = service
        .accept_challenge(
            &user_actor(22),
            "challenge-individual-full",
            AcceptChallengeCommand {
                guest_team_id: None,
            },
        )
        .await
        .expect_err("full individual challenge should reject more users");

    assert!(matches!(
        error,
        registration_system_backend::shared::error::AppError::Conflict(_)
    ));
}

#[tokio::test]
async fn user_cannot_accept_two_overlapping_individual_challenges() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamRepository::new(vec![sample_team(
        "team-a",
        7,
        "银河联队",
    )]));
    let service = ChallengeService::new(
        repository.clone(),
        team_repository.clone(),
        notification_service(),
    );
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    repository
        .create(&sample_challenge(
            "challenge-individual-first",
            "team-a",
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
            "team-a",
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
    let team_repository = Arc::new(FakeTeamRepository::new(vec![sample_team(
        "team-a",
        7,
        "银河联队",
    )]));
    let service = ChallengeService::new(repository, team_repository, notification_service());
    let holding_date = Utc::now().naive_utc() + Duration::days(1);

    let challenge = service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                host_team_id: "team-a".to_string(),
                title: "周二练习赛".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "东湖公园 5 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 5,
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
                guest_team_id: Some("team-a".to_string()),
            },
        )
        .await
        .expect_err("same team should not accept its own challenge");

    assert!(error.to_string().contains("不能接自己发布的约队"));
}

#[tokio::test]
async fn admin_can_list_challenges_across_managed_teams() {
    let repository = Arc::new(FakeChallengeRepository::default());
    let team_repository = Arc::new(FakeTeamRepository::new(vec![
        sample_team("team-a", 7, "银河联队"),
        sample_team("team-b", 8, "柏林二队"),
    ]));
    let service = ChallengeService::new(repository, team_repository, notification_service());
    let holding_date = Utc::now().naive_utc() + Duration::days(2);

    service
        .create_challenge(
            &user_actor(7),
            CreateChallengeCommand {
                kind: ChallengeKind::Team,
                host_team_id: "team-a".to_string(),
                title: "A 队周末约队".to_string(),
                holding_date,
                start_time: holding_date,
                end_time: holding_date + Duration::hours(2),
                location: "主城 1 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 8,
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
                host_team_id: "team-b".to_string(),
                title: "B 队夜场约队".to_string(),
                holding_date: holding_date + Duration::days(1),
                start_time: holding_date + Duration::days(1),
                end_time: holding_date + Duration::days(1) + Duration::hours(2),
                location: "主城 2 号场".to_string(),
                location_latitude: None,
                location_longitude: None,
                players_per_team: 6,
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
                include_closed: false,
                limit: 50,
                sort: "holding_date_asc".to_string(),
            },
        )
        .await
        .expect("super admin should list all challenges");

    assert_eq!(items.len(), 2);
}
