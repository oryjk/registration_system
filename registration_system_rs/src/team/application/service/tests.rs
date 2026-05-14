use super::*;
use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
    ActivityTeamCheckInConfig, DomainError as ActivityDomainError, RegistrationListPage,
};
use crate::activity::ports::ActivityQueryRepository;
use crate::team::application::{
    SubmitActivityReviewCommand, TeamCreditPenaltyCommand, TeamMembershipRechargeCommand,
    TeamPrincipal,
};
use crate::team::domain::{
    ActivityTeamReview, DEFAULT_TEAM_CREDIT_SCORE, DomainError, Team, TeamAdminInfo,
    TeamAttendanceRankingItem, TeamCreditTransaction, TeamMember, TeamMemberAttendanceRecord,
    TeamMemberWithInfo, UpdateTeamFields,
};
use crate::team::ports::{
    ActivityReviewRecord, MembershipRechargeRecord, TeamCommandRepository, TeamQueryRepository,
};
use async_trait::async_trait;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct FakeTeamStore {
    teams: Mutex<HashMap<i64, Team>>,
    members: Mutex<HashMap<i64, Vec<TeamMember>>>,
    member_attendance_records: Mutex<HashMap<(i64, i64), Vec<TeamMemberAttendanceRecord>>>,
    team_attendance_ranking: Mutex<HashMap<i64, Vec<TeamAttendanceRankingItem>>>,
    credit_transactions: Mutex<HashMap<i64, Vec<TeamCreditTransaction>>>,
    reviews: Mutex<HashMap<(String, i64), ActivityTeamReview>>,
}

impl FakeTeamStore {
    async fn create(&self, team: &Team) -> Result<(), DomainError> {
        self.teams
            .lock()
            .expect("teams mutex poisoned")
            .insert(team.id, team.clone());
        Ok(())
    }

    async fn find_by_id(&self, team_id: i64) -> Result<Option<Team>, DomainError> {
        Ok(self
            .teams
            .lock()
            .expect("teams mutex poisoned")
            .get(&team_id)
            .cloned())
    }

    async fn find_by_name(&self, name: &str) -> Result<Option<Team>, DomainError> {
        Ok(self
            .teams
            .lock()
            .expect("teams mutex poisoned")
            .values()
            .find(|team| team.name == name)
            .cloned())
    }

    async fn list(&self, _active_only: bool) -> Result<Vec<Team>, DomainError> {
        Ok(self
            .teams
            .lock()
            .expect("teams mutex poisoned")
            .values()
            .cloned()
            .collect())
    }

    async fn search(&self, _keyword: &str) -> Result<Vec<Team>, DomainError> {
        self.list(true).await
    }

    async fn update(
        &self,
        _team_id: i64,
        _fields: UpdateTeamFields<'_>,
    ) -> Result<(), DomainError> {
        Ok(())
    }

    async fn delete(&self, _team_id: i64) -> Result<(), DomainError> {
        Ok(())
    }

    async fn add_member(
        &self,
        team_id: i64,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
    ) -> Result<(), DomainError> {
        let mut members = self.members.lock().expect("members mutex poisoned");
        members.entry(team_id).or_default().push(TeamMember {
            id: user_id,
            team_id,
            user_id,
            role: role.to_string(),
            jersey_number: jersey_number.map(str::to_string),
            joined_at: Utc::now().naive_utc(),
            status: 1,
            created_at: Utc::now().naive_utc(),
            updated_at: Utc::now().naive_utc(),
        });
        Ok(())
    }

    async fn reactivate_member(
        &self,
        _team_id: i64,
        _user_id: i64,
        _role: &str,
        _jersey_number: Option<&str>,
    ) -> Result<(), DomainError> {
        Ok(())
    }

    async fn remove_member(&self, _team_id: i64, _user_id: i64) -> Result<(), DomainError> {
        Ok(())
    }

    async fn batch_remove_members(
        &self,
        _team_id: i64,
        _user_ids: &[i64],
    ) -> Result<u64, DomainError> {
        Ok(0)
    }

    async fn update_member(
        &self,
        _team_id: i64,
        _user_id: i64,
        _role: Option<&str>,
        _jersey_number: Option<Option<&str>>,
    ) -> Result<(), DomainError> {
        Ok(())
    }

    async fn batch_update_member_status(
        &self,
        _team_id: i64,
        _user_ids: &[i64],
        _status: i8,
    ) -> Result<u64, DomainError> {
        Ok(0)
    }

    async fn is_member(&self, team_id: i64, user_id: i64) -> Result<bool, DomainError> {
        Ok(self
            .members
            .lock()
            .expect("members mutex poisoned")
            .get(&team_id)
            .is_some_and(|items| items.iter().any(|member| member.user_id == user_id)))
    }

    async fn get_member_status(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<i8>, DomainError> {
        Ok(self
            .members
            .lock()
            .expect("members mutex poisoned")
            .get(&team_id)
            .and_then(|items| {
                items
                    .iter()
                    .find(|member| member.user_id == user_id)
                    .map(|member| member.status)
            }))
    }

    async fn list_members(&self, team_id: i64) -> Result<Vec<TeamMember>, DomainError> {
        Ok(self
            .members
            .lock()
            .expect("members mutex poisoned")
            .get(&team_id)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter(|member| member.status == 1)
            .collect())
    }

    async fn list_members_for_management(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamMember>, DomainError> {
        Ok(self
            .members
            .lock()
            .expect("members mutex poisoned")
            .get(&team_id)
            .cloned()
            .unwrap_or_default())
    }

    async fn list_member_attendance_records(
        &self,
        team_id: i64,
        user_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<TeamMemberAttendanceRecord>, DomainError> {
        Ok(self
            .member_attendance_records
            .lock()
            .expect("member attendance records mutex poisoned")
            .get(&(team_id, user_id))
            .cloned()
            .unwrap_or_default())
    }

    async fn list_team_attendance_ranking(
        &self,
        team_id: i64,
        _start_date: Option<&str>,
        _end_date: Option<&str>,
    ) -> Result<Vec<TeamAttendanceRankingItem>, DomainError> {
        Ok(self
            .team_attendance_ranking
            .lock()
            .expect("team attendance ranking mutex poisoned")
            .get(&team_id)
            .cloned()
            .unwrap_or_default())
    }

    async fn list_user_teams(&self, user_id: i64) -> Result<Vec<Team>, DomainError> {
        let teams = self.teams.lock().expect("teams mutex poisoned");
        let members = self.members.lock().expect("members mutex poisoned");
        Ok(teams
            .values()
            .filter(|team| {
                members
                    .get(&team.id)
                    .is_some_and(|items| items.iter().any(|member| member.user_id == user_id))
            })
            .cloned()
            .collect())
    }

    async fn list_members_with_info(
        &self,
        _team_id: i64,
    ) -> Result<Vec<TeamMemberWithInfo>, DomainError> {
        Ok(Vec::new())
    }

    async fn assign_admin(&self, _team_id: i64, _admin_id: i64) -> Result<(), DomainError> {
        Ok(())
    }

    async fn unassign_admin(&self, _team_id: i64, _admin_id: i64) -> Result<(), DomainError> {
        Ok(())
    }

    async fn list_team_admins_with_info(
        &self,
        _team_id: i64,
    ) -> Result<Vec<TeamAdminInfo>, DomainError> {
        Ok(Vec::new())
    }

    async fn is_admin_assigned(&self, _team_id: i64, _admin_id: i64) -> Result<bool, DomainError> {
        Ok(false)
    }

    async fn list_teams_by_admin(&self, _admin_id: i64) -> Result<Vec<Team>, DomainError> {
        Ok(Vec::new())
    }

    async fn list_credit_transactions(
        &self,
        team_id: i64,
        limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, DomainError> {
        let items = self
            .credit_transactions
            .lock()
            .expect("credit transactions mutex poisoned")
            .get(&team_id)
            .cloned()
            .unwrap_or_default();
        Ok(items.into_iter().take(limit.max(0) as usize).collect())
    }

    async fn find_activity_review(
        &self,
        activity_id: &str,
        reviewer_team_id: i64,
    ) -> Result<Option<ActivityTeamReview>, DomainError> {
        Ok(self
            .reviews
            .lock()
            .expect("reviews mutex poisoned")
            .get(&(activity_id.to_string(), reviewer_team_id))
            .cloned())
    }

    async fn record_activity_review(
        &self,
        record: ActivityReviewRecord<'_>,
    ) -> Result<Team, DomainError> {
        let mut teams = self.teams.lock().expect("teams mutex poisoned");
        let team = teams
            .get_mut(&record.reviewee_team_id)
            .expect("reviewee team should exist");
        team.credit_score = record.score_after;
        team.updated_at = Utc::now().naive_utc();

        let review = ActivityTeamReview {
            id: 1,
            activity_id: record.activity_id.to_string(),
            reviewer_team_id: record.reviewer_team_id,
            reviewer_user_id: record.reviewer_user_id,
            reviewee_team_id: record.reviewee_team_id,
            rating: record.rating,
            credit_delta: record.credit_delta,
            comment: record.comment.map(str::to_string),
            created_at: Utc::now().naive_utc(),
            updated_at: Utc::now().naive_utc(),
        };
        self.reviews.lock().expect("reviews mutex poisoned").insert(
            (record.activity_id.to_string(), record.reviewer_team_id),
            review,
        );

        self.credit_transactions
            .lock()
            .expect("credit transactions mutex poisoned")
            .entry(record.reviewee_team_id)
            .or_default()
            .push(TeamCreditTransaction {
                id: 1,
                team_id: record.reviewee_team_id,
                activity_id: Some(record.activity_id.to_string()),
                transaction_type: "match_review".to_string(),
                delta: record.credit_delta,
                score_before: record.score_before,
                score_after: record.score_after,
                rating: Some(record.rating),
                amount: None,
                membership_months: None,
                note: record.comment.map(str::to_string),
                reviewer_team_id: Some(record.reviewer_team_id),
                created_by_user_id: Some(record.reviewer_user_id),
                created_by_admin_id: None,
                created_at: Utc::now().naive_utc(),
            });

        Ok(team.clone())
    }

    async fn record_membership_recharge(
        &self,
        record: MembershipRechargeRecord<'_>,
    ) -> Result<Team, DomainError> {
        let mut teams = self.teams.lock().expect("teams mutex poisoned");
        let team = teams.get_mut(&record.team_id).expect("team should exist");
        team.credit_score = record.score_after;
        team.vip_until = Some(record.vip_until);
        team.updated_at = Utc::now().naive_utc();

        self.credit_transactions
            .lock()
            .expect("credit transactions mutex poisoned")
            .entry(record.team_id)
            .or_default()
            .push(TeamCreditTransaction {
                id: 2,
                team_id: record.team_id,
                activity_id: None,
                transaction_type: "membership_recharge".to_string(),
                delta: record.credit_delta,
                score_before: record.score_before,
                score_after: record.score_after,
                rating: None,
                amount: Some(record.amount),
                membership_months: Some(record.months),
                note: record.note.map(str::to_string),
                reviewer_team_id: None,
                created_by_user_id: Some(record.operator_user_id),
                created_by_admin_id: None,
                created_at: Utc::now().naive_utc(),
            });

        Ok(team.clone())
    }

    async fn record_credit_penalty(
        &self,
        team_id: i64,
        admin_id: i64,
        points: i32,
        reason: &str,
        score_before: i32,
        score_after: i32,
    ) -> Result<Team, DomainError> {
        let mut teams = self.teams.lock().expect("teams mutex poisoned");
        let team = teams.get_mut(&team_id).expect("team should exist");
        team.credit_score = score_after;
        team.updated_at = Utc::now().naive_utc();

        self.credit_transactions
            .lock()
            .expect("credit transactions mutex poisoned")
            .entry(team_id)
            .or_default()
            .push(TeamCreditTransaction {
                id: 3,
                team_id,
                activity_id: None,
                transaction_type: "manual_penalty".to_string(),
                delta: -points,
                score_before,
                score_after,
                rating: None,
                amount: None,
                membership_months: None,
                note: Some(reason.to_string()),
                reviewer_team_id: None,
                created_by_user_id: None,
                created_by_admin_id: Some(admin_id),
                created_at: Utc::now().naive_utc(),
            });

        Ok(team.clone())
    }
}

#[async_trait]
impl TeamQueryRepository for FakeTeamStore {
    async fn find_by_id(&self, team_id: i64) -> Result<Option<Team>, DomainError> {
        FakeTeamStore::find_by_id(self, team_id).await
    }

    async fn find_by_name(&self, name: &str) -> Result<Option<Team>, DomainError> {
        FakeTeamStore::find_by_name(self, name).await
    }

    async fn list(&self, active_only: bool) -> Result<Vec<Team>, DomainError> {
        FakeTeamStore::list(self, active_only).await
    }

    async fn search(&self, keyword: &str) -> Result<Vec<Team>, DomainError> {
        FakeTeamStore::search(self, keyword).await
    }

    async fn is_member(&self, team_id: i64, user_id: i64) -> Result<bool, DomainError> {
        FakeTeamStore::is_member(self, team_id, user_id).await
    }

    async fn get_member_status(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<i8>, DomainError> {
        FakeTeamStore::get_member_status(self, team_id, user_id).await
    }

    async fn list_members(&self, team_id: i64) -> Result<Vec<TeamMember>, DomainError> {
        FakeTeamStore::list_members(self, team_id).await
    }

    async fn list_members_for_management(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamMember>, DomainError> {
        FakeTeamStore::list_members_for_management(self, team_id).await
    }

    async fn list_member_attendance_records(
        &self,
        team_id: i64,
        user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<TeamMemberAttendanceRecord>, DomainError> {
        FakeTeamStore::list_member_attendance_records(self, team_id, user_id, start_date, end_date)
            .await
    }

    async fn list_team_attendance_ranking(
        &self,
        team_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<TeamAttendanceRankingItem>, DomainError> {
        FakeTeamStore::list_team_attendance_ranking(self, team_id, start_date, end_date).await
    }

    async fn list_user_teams(&self, user_id: i64) -> Result<Vec<Team>, DomainError> {
        FakeTeamStore::list_user_teams(self, user_id).await
    }

    async fn list_members_with_info(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamMemberWithInfo>, DomainError> {
        FakeTeamStore::list_members_with_info(self, team_id).await
    }

    async fn list_team_admins_with_info(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamAdminInfo>, DomainError> {
        FakeTeamStore::list_team_admins_with_info(self, team_id).await
    }

    async fn is_admin_assigned(&self, team_id: i64, admin_id: i64) -> Result<bool, DomainError> {
        FakeTeamStore::is_admin_assigned(self, team_id, admin_id).await
    }

    async fn list_teams_by_admin(&self, admin_id: i64) -> Result<Vec<Team>, DomainError> {
        FakeTeamStore::list_teams_by_admin(self, admin_id).await
    }

    async fn list_credit_transactions(
        &self,
        team_id: i64,
        limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, DomainError> {
        FakeTeamStore::list_credit_transactions(self, team_id, limit).await
    }

    async fn find_activity_review(
        &self,
        activity_id: &str,
        reviewer_team_id: i64,
    ) -> Result<Option<ActivityTeamReview>, DomainError> {
        FakeTeamStore::find_activity_review(self, activity_id, reviewer_team_id).await
    }
}

#[async_trait]
impl TeamCommandRepository for FakeTeamStore {
    async fn create(&self, team: &Team) -> Result<Team, DomainError> {
        FakeTeamStore::create(self, team).await.map(|_| {
            let mut created = team.clone();
            if created.id == 0 {
                created.id = 1;
            }
            created
        })
    }

    async fn update(&self, team_id: i64, fields: UpdateTeamFields<'_>) -> Result<(), DomainError> {
        FakeTeamStore::update(self, team_id, fields).await
    }

    async fn delete(&self, team_id: i64) -> Result<(), DomainError> {
        FakeTeamStore::delete(self, team_id).await
    }

    async fn add_member(
        &self,
        team_id: i64,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
    ) -> Result<(), DomainError> {
        FakeTeamStore::add_member(self, team_id, user_id, role, jersey_number).await
    }

    async fn reactivate_member(
        &self,
        team_id: i64,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
    ) -> Result<(), DomainError> {
        FakeTeamStore::reactivate_member(self, team_id, user_id, role, jersey_number).await
    }

    async fn remove_member(&self, team_id: i64, user_id: i64) -> Result<(), DomainError> {
        FakeTeamStore::remove_member(self, team_id, user_id).await
    }

    async fn batch_remove_members(
        &self,
        team_id: i64,
        user_ids: &[i64],
    ) -> Result<u64, DomainError> {
        FakeTeamStore::batch_remove_members(self, team_id, user_ids).await
    }

    async fn update_member(
        &self,
        team_id: i64,
        user_id: i64,
        role: Option<&str>,
        jersey_number: Option<Option<&str>>,
    ) -> Result<(), DomainError> {
        FakeTeamStore::update_member(self, team_id, user_id, role, jersey_number).await
    }

    async fn batch_update_member_status(
        &self,
        team_id: i64,
        user_ids: &[i64],
        status: i8,
    ) -> Result<u64, DomainError> {
        FakeTeamStore::batch_update_member_status(self, team_id, user_ids, status).await
    }

    async fn assign_admin(&self, team_id: i64, admin_id: i64) -> Result<(), DomainError> {
        FakeTeamStore::assign_admin(self, team_id, admin_id).await
    }

    async fn unassign_admin(&self, team_id: i64, admin_id: i64) -> Result<(), DomainError> {
        FakeTeamStore::unassign_admin(self, team_id, admin_id).await
    }

    async fn record_activity_review(
        &self,
        record: ActivityReviewRecord<'_>,
    ) -> Result<Team, DomainError> {
        FakeTeamStore::record_activity_review(self, record).await
    }

    async fn record_membership_recharge(
        &self,
        record: MembershipRechargeRecord<'_>,
    ) -> Result<Team, DomainError> {
        FakeTeamStore::record_membership_recharge(self, record).await
    }

    async fn record_credit_penalty(
        &self,
        team_id: i64,
        admin_id: i64,
        points: i32,
        reason: &str,
        score_before: i32,
        score_after: i32,
    ) -> Result<Team, DomainError> {
        FakeTeamStore::record_credit_penalty(
            self,
            team_id,
            admin_id,
            points,
            reason,
            score_before,
            score_after,
        )
        .await
    }
}

struct DummyActivityRepository {
    activities: Mutex<HashMap<String, Activity>>,
}

impl DummyActivityRepository {
    fn with_activity(activity: Activity) -> Self {
        let mut activities = HashMap::new();
        activities.insert(activity.id.clone(), activity);
        Self {
            activities: Mutex::new(activities),
        }
    }
}

#[async_trait]
impl ActivityQueryRepository for DummyActivityRepository {
    async fn list_page(
        &self,
        _status_filter: Option<i8>,
        _page: u32,
        _page_size: u32,
    ) -> Result<ActivityListPage, ActivityDomainError> {
        unreachable!("not used")
    }

    async fn find_by_id(&self, activity_id: &str) -> Result<Option<Activity>, ActivityDomainError> {
        Ok(self
            .activities
            .lock()
            .expect("activities mutex poisoned")
            .get(activity_id)
            .cloned())
    }

    async fn find_derived_by_source_and_team(
        &self,
        _source_activity_id: &str,
        _team_id: i64,
    ) -> Result<Option<Activity>, ActivityDomainError> {
        Ok(None)
    }

    async fn find_ongoing_activity(&self) -> Result<Option<Activity>, ActivityDomainError> {
        unreachable!("not used")
    }

    async fn list_registrations(
        &self,
        _activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, ActivityDomainError> {
        unreachable!("not used")
    }

    async fn count_capacity_registrations(
        &self,
        _activity_id: &str,
    ) -> Result<i64, ActivityDomainError> {
        Ok(0)
    }

    async fn list_registrations_with_info_page(
        &self,
        _activity_id: &str,
        _activity_holding_date: chrono::NaiveDateTime,
        _stand_filter: Option<i8>,
        _page: u32,
        _page_size: u32,
    ) -> Result<RegistrationListPage, ActivityDomainError> {
        unreachable!("not used")
    }

    async fn list_team_checkin_configs(
        &self,
        _activity_id: &str,
    ) -> Result<Vec<ActivityTeamCheckInConfig>, ActivityDomainError> {
        Ok(Vec::new())
    }

    async fn find_team_checkin_config(
        &self,
        _activity_id: &str,
        _team_id: i64,
    ) -> Result<Option<ActivityTeamCheckInConfig>, ActivityDomainError> {
        Ok(None)
    }

    async fn find_checkin_record(
        &self,
        _activity_id: &str,
        _team_id: i64,
        _user_id: i64,
    ) -> Result<Option<ActivityCheckInRecord>, ActivityDomainError> {
        Ok(None)
    }
}

#[tokio::test]
async fn team_detail_includes_frozen_members_for_management_view() {
    let repository = Arc::new(FakeTeamStore::default());
    let now = Utc::now().naive_utc();
    repository
        .create(&Team {
            id: 1,
            name: "A".to_string(),
            description: None,
            logo_url: None,
            captain_id: Some(1),
            join_password_hash: None,
            status: 1,
            credit_score: DEFAULT_TEAM_CREDIT_SCORE,
            vip_until: None,
            created_at: now,
            updated_at: now,
        })
        .await
        .expect("create team");

    repository
        .members
        .lock()
        .expect("members mutex poisoned")
        .insert(
            1,
            vec![
                TeamMember {
                    id: 1,
                    team_id: 1,
                    user_id: 1,
                    role: "captain".to_string(),
                    jersey_number: Some("10".to_string()),
                    joined_at: now,
                    status: 1,
                    created_at: now,
                    updated_at: now,
                },
                TeamMember {
                    id: 2,
                    team_id: 1,
                    user_id: 2,
                    role: "member".to_string(),
                    jersey_number: Some("7".to_string()),
                    joined_at: now,
                    status: 0,
                    created_at: now,
                    updated_at: now,
                },
            ],
        );

    let service = TeamService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(DummyActivityRepository {
            activities: Mutex::new(HashMap::new()),
        }),
    );

    let detail = service.get_team_detail(1).await.expect("get team detail");

    assert_eq!(detail.members.len(), 2);
    assert!(
        detail
            .members
            .iter()
            .any(|member| member.user_id == 2 && member.status == 0)
    );
}

#[tokio::test]
async fn captain_can_view_member_attendance_records_with_unregistered_matches() {
    let repository = Arc::new(FakeTeamStore::default());
    let now = Utc::now().naive_utc();
    repository
        .create(&Team {
            id: 1,
            name: "A".to_string(),
            description: None,
            logo_url: None,
            captain_id: Some(1),
            join_password_hash: None,
            status: 1,
            credit_score: DEFAULT_TEAM_CREDIT_SCORE,
            vip_until: None,
            created_at: now,
            updated_at: now,
        })
        .await
        .expect("create team");
    repository
        .members
        .lock()
        .expect("members mutex poisoned")
        .insert(
            1,
            vec![TeamMember {
                id: 2,
                team_id: 1,
                user_id: 2,
                role: "member".to_string(),
                jersey_number: Some("7".to_string()),
                joined_at: now,
                status: 1,
                created_at: now,
                updated_at: now,
            }],
        );
    repository
        .member_attendance_records
        .lock()
        .expect("member attendance records mutex poisoned")
        .insert(
            (1, 2),
            vec![
                TeamMemberAttendanceRecord {
                    activity_id: "activity-joined".to_string(),
                    activity_name: "周三友谊赛".to_string(),
                    holding_date: now,
                    location: "东安湖球场".to_string(),
                    stand: 1,
                    registration_count: 1,
                    operation_time: Some(now),
                    registered: true,
                },
                TeamMemberAttendanceRecord {
                    activity_id: "activity-unregistered".to_string(),
                    activity_name: "周末训练赛".to_string(),
                    holding_date: now,
                    location: "洺悦御府球场".to_string(),
                    stand: 0,
                    registration_count: 0,
                    operation_time: None,
                    registered: false,
                },
            ],
        );

    let service = TeamService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(DummyActivityRepository {
            activities: Mutex::new(HashMap::new()),
        }),
    );

    let attendance = service
        .get_member_attendance_records(&TeamPrincipal::user(1), 1, 2, None, None)
        .await
        .expect("get member attendance records");

    assert_eq!(attendance.records.len(), 2);
    assert!(attendance.records.iter().any(|record| record.registered));
    assert!(attendance.records.iter().any(|record| !record.registered));
}

#[tokio::test]
async fn team_member_can_view_year_attendance_summary_with_avatar_ranking() {
    let repository = Arc::new(FakeTeamStore::default());
    let now = Utc::now().naive_utc();
    repository
        .create(&Team {
            id: 1,
            name: "A".to_string(),
            description: None,
            logo_url: None,
            captain_id: Some(1),
            join_password_hash: None,
            status: 1,
            credit_score: DEFAULT_TEAM_CREDIT_SCORE,
            vip_until: None,
            created_at: now,
            updated_at: now,
        })
        .await
        .expect("create team");
    repository
        .members
        .lock()
        .expect("members mutex poisoned")
        .insert(
            1,
            vec![
                TeamMember {
                    id: 1,
                    team_id: 1,
                    user_id: 1,
                    role: "captain".to_string(),
                    jersey_number: Some("10".to_string()),
                    joined_at: now,
                    status: 1,
                    created_at: now,
                    updated_at: now,
                },
                TeamMember {
                    id: 2,
                    team_id: 1,
                    user_id: 2,
                    role: "member".to_string(),
                    jersey_number: Some("7".to_string()),
                    joined_at: now,
                    status: 1,
                    created_at: now,
                    updated_at: now,
                },
            ],
        );
    repository
        .member_attendance_records
        .lock()
        .expect("member attendance records mutex poisoned")
        .insert(
            (1, 2),
            vec![
                TeamMemberAttendanceRecord {
                    activity_id: "activity-joined".to_string(),
                    activity_name: "周三友谊赛".to_string(),
                    holding_date: now,
                    location: "东安湖球场".to_string(),
                    stand: 1,
                    registration_count: 1,
                    operation_time: Some(now),
                    registered: true,
                },
                TeamMemberAttendanceRecord {
                    activity_id: "activity-unregistered".to_string(),
                    activity_name: "周末训练赛".to_string(),
                    holding_date: now,
                    location: "洺悦御府球场".to_string(),
                    stand: 0,
                    registration_count: 0,
                    operation_time: None,
                    registered: false,
                },
            ],
        );
    repository
        .team_attendance_ranking
        .lock()
        .expect("team attendance ranking mutex poisoned")
        .insert(
            1,
            vec![TeamAttendanceRankingItem {
                user_id: 2,
                user_name: "王东".to_string(),
                avatar_url: Some("https://example.com/avatar.jpg".to_string()),
                total_count: 2,
                attended_count: 1,
                leave_count: 0,
                late_count: 0,
                unregistered_count: 1,
            }],
        );

    let service = TeamService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(DummyActivityRepository {
            activities: Mutex::new(HashMap::new()),
        }),
    );

    let summary = service
        .get_team_attendance_summary(
            &TeamPrincipal::user(2),
            1,
            Some("2026-01-01"),
            Some("2026-12-31"),
        )
        .await
        .expect("get team attendance summary");

    assert_eq!(summary.my_records.len(), 2);
    assert!(summary.my_records.iter().any(|record| !record.registered));
    assert_eq!(
        summary.ranking[0].avatar_url.as_deref(),
        Some("https://example.com/avatar.jpg")
    );
    assert_eq!(summary.ranking[0].attended_count, 1);
    assert_eq!(summary.ranking[0].unregistered_count, 1);
}

#[tokio::test]
async fn captain_can_submit_post_match_review_and_raise_opponent_credit() {
    let repository = Arc::new(FakeTeamStore::default());
    let now = Utc::now().naive_utc();
    let activity = Activity {
        id: "activity-1".to_string(),
        cover: None,
        start_time: now,
        end_time: now,
        holding_date: now,
        location: "球场".to_string(),
        location_latitude: None,
        location_longitude: None,
        name: "约战".to_string(),
        opposing: None,
        status: 2,
        description: None,
        home_team_id: Some(1),
        away_team_id: Some(2),
        color: None,
        opposing_color: None,
        players_per_team: Some(7),
        match_kind: Some("external".to_string()),
        source_activity_id: None,
        team_registration_count: None,
        team_checkin_configs: vec![],
        created_at: now,
        updated_at: now,
    };

    repository
        .create(&Team {
            id: 1,
            name: "A".to_string(),
            description: None,
            logo_url: None,
            captain_id: Some(1),
            join_password_hash: None,
            status: 1,
            credit_score: DEFAULT_TEAM_CREDIT_SCORE,
            vip_until: None,
            created_at: now,
            updated_at: now,
        })
        .await
        .expect("create team a");
    repository
        .create(&Team {
            id: 2,
            name: "B".to_string(),
            description: None,
            logo_url: None,
            captain_id: Some(2),
            join_password_hash: None,
            status: 1,
            credit_score: DEFAULT_TEAM_CREDIT_SCORE,
            vip_until: None,
            created_at: now,
            updated_at: now,
        })
        .await
        .expect("create team b");

    let service = TeamService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(DummyActivityRepository::with_activity(activity)),
    );
    let updated = service
        .submit_activity_review(
            &TeamPrincipal::user(1),
            1,
            SubmitActivityReviewCommand {
                activity_id: "activity-1".to_string(),
                reviewer_team_id: 1,
                rating: 4,
                comment: Some("到场准时".to_string()),
            },
        )
        .await
        .expect("submit activity review");

    assert_eq!(updated.team.id, 2);
    assert_eq!(updated.team.credit_score, 66);
    assert_eq!(
        repository
            .list_credit_transactions(2, 10)
            .await
            .expect("list transactions")
            .len(),
        1
    );
}

#[tokio::test]
async fn captain_can_recharge_membership_and_extend_vip() {
    let repository = Arc::new(FakeTeamStore::default());
    let now = Utc::now().naive_utc();

    repository
        .create(&Team {
            id: 1,
            name: "A".to_string(),
            description: None,
            logo_url: None,
            captain_id: Some(1),
            join_password_hash: None,
            status: 1,
            credit_score: 48,
            vip_until: None,
            created_at: now,
            updated_at: now,
        })
        .await
        .expect("create team a");

    let service = TeamService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(DummyActivityRepository {
            activities: Mutex::new(HashMap::new()),
        }),
    );
    let updated = service
        .recharge_membership(
            &TeamPrincipal::user(1),
            1,
            TeamMembershipRechargeCommand {
                months: 2,
                note: Some("补充信用".to_string()),
            },
        )
        .await
        .expect("recharge membership");

    assert_eq!(updated.team.credit_score, 60);
    assert!(updated.team.vip_until.is_some());
    assert!(updated.is_vip);
}

#[tokio::test]
async fn admin_can_apply_credit_penalty() {
    let repository = Arc::new(FakeTeamStore::default());
    let now = Utc::now().naive_utc();

    repository
        .create(&Team {
            id: 1,
            name: "A".to_string(),
            description: None,
            logo_url: None,
            captain_id: Some(1),
            join_password_hash: None,
            status: 1,
            credit_score: 72,
            vip_until: None,
            created_at: now,
            updated_at: now,
        })
        .await
        .expect("create team a");

    let service = TeamService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(DummyActivityRepository {
            activities: Mutex::new(HashMap::new()),
        }),
    );
    let updated = service
        .apply_credit_penalty(
            &TeamPrincipal::admin(99, true),
            1,
            TeamCreditPenaltyCommand {
                points: 18,
                reason: "临时放鸽子".to_string(),
            },
        )
        .await
        .expect("apply credit penalty");

    assert_eq!(updated.team.credit_score, 54);
    assert_eq!(updated.trust_label, "风险较高");
}
