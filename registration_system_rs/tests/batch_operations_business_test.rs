use async_trait::async_trait;
use chrono::Utc;
use registration_system_backend::activity::application::{ActivityPrincipal, ActivityService};
use registration_system_backend::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
    ActivityTeamCheckInConfig, DomainError as ActivityDomainError, RegistrationListPage,
    RegistrationStandCounts, UpdateActivityFields,
};
use registration_system_backend::activity::ports::{
    ActivityCommandRepository, ActivityQueryRepository, ActivityTeamAccessPort,
};
use registration_system_backend::team::application::{
    TeamApplicationError, TeamPrincipal, TeamService,
};
use registration_system_backend::team::domain::{
    ActivityTeamReview, DEFAULT_TEAM_CREDIT_SCORE, DomainError as TeamDomainError, Team,
    TeamAdminInfo, TeamAttendanceRankingItem, TeamCreditTransaction, TeamMember,
    TeamMemberAttendanceRecord, TeamMemberWithInfo, UpdateTeamFields,
};
use registration_system_backend::team::ports::{TeamCommandRepository, TeamQueryRepository};
use std::sync::{Arc, Mutex};

fn activity_admin_principal(is_super_admin: bool) -> ActivityPrincipal {
    ActivityPrincipal::admin(1, is_super_admin)
}

fn team_admin_principal(is_super_admin: bool) -> TeamPrincipal {
    TeamPrincipal::admin(1, is_super_admin)
}

fn sample_activity(activity_id: &str) -> Activity {
    let now = Utc::now().naive_utc();
    Activity {
        id: activity_id.to_string(),
        cover: None,
        start_time: now,
        end_time: now,
        holding_date: now,
        location: "球场".to_string(),
        location_latitude: None,
        location_longitude: None,
        name: "周四友谊赛".to_string(),
        opposing: None,
        status: 0,
        description: None,
        home_team_id: None,
        away_team_id: None,
        color: None,
        opposing_color: None,
        players_per_team: Some(8),
        match_kind: Some("external".to_string()),
        source_activity_id: None,
        team_registration_count: None,
        team_checkin_configs: vec![],
        created_at: now,
        updated_at: now,
    }
}

fn sample_team(team_id: i64) -> Team {
    let now = Utc::now().naive_utc();
    Team {
        id: team_id,
        name: "测试球队".to_string(),
        description: None,
        logo_url: None,
        captain_id: Some(99),
        join_password_hash: None,
        status: 1,
        credit_score: DEFAULT_TEAM_CREDIT_SCORE,
        vip_until: None,
        created_at: now,
        updated_at: now,
    }
}

#[derive(Default)]
struct FakeActivityRepository {
    upsert_calls: Mutex<Vec<(String, i64, i8, i32)>>,
}

#[async_trait]
impl ActivityQueryRepository for FakeActivityRepository {
    async fn list_page(
        &self,
        _status_filter: Option<i8>,
        _page: u32,
        _page_size: u32,
    ) -> Result<ActivityListPage, ActivityDomainError> {
        unimplemented!()
    }

    async fn find_by_id(&self, activity_id: &str) -> Result<Option<Activity>, ActivityDomainError> {
        Ok(Some(sample_activity(activity_id)))
    }

    async fn find_derived_by_source_and_team(
        &self,
        _source_activity_id: &str,
        _team_id: i64,
    ) -> Result<Option<Activity>, ActivityDomainError> {
        Ok(None)
    }

    async fn find_ongoing_activity(&self) -> Result<Option<Activity>, ActivityDomainError> {
        unimplemented!()
    }

    async fn list_registrations(
        &self,
        _activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, ActivityDomainError> {
        unimplemented!()
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
        Ok(RegistrationListPage {
            items: Vec::new(),
            total: 0,
            page: 1,
            page_size: 20,
            counts: RegistrationStandCounts {
                total: 0,
                unknown: 0,
                attending: 0,
                leave: 0,
                absent: 0,
            },
        })
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

#[async_trait]
impl ActivityCommandRepository for FakeActivityRepository {
    async fn create(&self, _activity: &Activity) -> Result<(), ActivityDomainError> {
        unimplemented!()
    }

    async fn delete_many(&self, _ids: &[String]) -> Result<(), ActivityDomainError> {
        unimplemented!()
    }

    async fn update_status(
        &self,
        _activity_id: &str,
        _status: i8,
    ) -> Result<(), ActivityDomainError> {
        unimplemented!()
    }

    async fn update_activity(
        &self,
        _activity_id: &str,
        _fields: UpdateActivityFields<'_>,
    ) -> Result<(), ActivityDomainError> {
        unimplemented!()
    }

    async fn upsert_registration(
        &self,
        activity_id: &str,
        user_id: i64,
        stand: i8,
        registration_count: i32,
    ) -> Result<(), ActivityDomainError> {
        self.upsert_calls.lock().unwrap().push((
            activity_id.to_string(),
            user_id,
            stand,
            registration_count,
        ));
        Ok(())
    }

    async fn delete_registration(
        &self,
        _activity_id: &str,
        _user_id: i64,
    ) -> Result<u64, ActivityDomainError> {
        unimplemented!()
    }

    async fn backfill_team_member_registrations(
        &self,
        _activity_id: &str,
    ) -> Result<u64, ActivityDomainError> {
        unimplemented!()
    }

    async fn upsert_team_checkin_config(
        &self,
        _config: &ActivityTeamCheckInConfig,
    ) -> Result<(), ActivityDomainError> {
        Ok(())
    }

    async fn record_checkin(
        &self,
        record: &ActivityCheckInRecord,
    ) -> Result<ActivityCheckInRecord, ActivityDomainError> {
        Ok(record.clone())
    }
}

#[derive(Default)]
struct FakeActivityTeamAccessPort;

#[async_trait]
impl ActivityTeamAccessPort for FakeActivityTeamAccessPort {
    async fn find_active_member_role(
        &self,
        _team_id: i64,
        _user_id: i64,
    ) -> Result<Option<String>, String> {
        Ok(None)
    }
}

#[derive(Default)]
struct FakeTeamStore {
    batch_update_calls: Mutex<Vec<(String, Vec<i64>, i8)>>,
}

#[async_trait]
impl TeamQueryRepository for FakeTeamStore {
    async fn find_by_id(&self, team_id: i64) -> Result<Option<Team>, TeamDomainError> {
        Ok(Some(sample_team(team_id)))
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

    async fn list_members(&self, _team_id: i64) -> Result<Vec<TeamMember>, TeamDomainError> {
        Ok(Vec::new())
    }

    async fn list_members_for_management(
        &self,
        _team_id: i64,
    ) -> Result<Vec<TeamMember>, TeamDomainError> {
        Ok(Vec::new())
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
        _team_id: i64,
        _admin_id: i64,
    ) -> Result<bool, TeamDomainError> {
        Ok(false)
    }

    async fn list_teams_by_admin(&self, _admin_id: i64) -> Result<Vec<Team>, TeamDomainError> {
        unimplemented!()
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

#[async_trait]
impl TeamCommandRepository for FakeTeamStore {
    async fn create(&self, team: &Team) -> Result<Team, TeamDomainError> {
        Ok(team.clone())
    }

    async fn update(
        &self,
        _team_id: i64,
        _fields: UpdateTeamFields<'_>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn delete(&self, _team_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn add_member(
        &self,
        _team_id: i64,
        _user_id: i64,
        _role: &str,
        _jersey_number: Option<&str>,
        _is_member: bool,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn reactivate_member(
        &self,
        _team_id: i64,
        _user_id: i64,
        _role: &str,
        _jersey_number: Option<&str>,
        _is_member: bool,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn remove_member(&self, _team_id: i64, _user_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn batch_remove_members(
        &self,
        _team_id: i64,
        _user_ids: &[i64],
    ) -> Result<u64, TeamDomainError> {
        unimplemented!()
    }

    async fn update_member(
        &self,
        _team_id: i64,
        _user_id: i64,
        _role: Option<&str>,
        _jersey_number: Option<Option<&str>>,
        _is_member: Option<bool>,
    ) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn batch_update_member_status(
        &self,
        team_id: i64,
        user_ids: &[i64],
        status: i8,
    ) -> Result<u64, TeamDomainError> {
        self.batch_update_calls.lock().unwrap().push((
            team_id.to_string(),
            user_ids.to_vec(),
            status,
        ));
        Ok(user_ids.len() as u64)
    }

    async fn assign_admin(&self, _team_id: i64, _admin_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn unassign_admin(&self, _team_id: i64, _admin_id: i64) -> Result<(), TeamDomainError> {
        unimplemented!()
    }

    async fn record_activity_review(
        &self,
        _record: registration_system_backend::team::ports::ActivityReviewRecord<'_>,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }

    async fn record_membership_recharge(
        &self,
        _record: registration_system_backend::team::ports::MembershipRechargeRecord<'_>,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }

    async fn record_credit_penalty(
        &self,
        _team_id: i64,
        _admin_id: i64,
        _points: i32,
        _reason: &str,
        _score_before: i32,
        _score_after: i32,
    ) -> Result<Team, TeamDomainError> {
        unimplemented!()
    }
}

#[tokio::test]
async fn batch_update_user_stand_uses_single_upsert_semantics_for_each_user() {
    let repository = Arc::new(FakeActivityRepository::default());
    let service = ActivityService::new(
        repository.clone(),
        repository.clone(),
        None,
        Arc::new(FakeActivityTeamAccessPort),
    );

    let updated_count = service
        .batch_update_user_stand(
            &activity_admin_principal(true),
            "activity-1",
            &[101, 202],
            1,
            1,
        )
        .await
        .expect("批量报名应成功");

    assert_eq!(updated_count, 2);
    assert_eq!(
        repository.upsert_calls.lock().unwrap().as_slice(),
        &[
            ("activity-1".to_string(), 101, 1, 1),
            ("activity-1".to_string(), 202, 1, 1),
        ]
    );
}

#[tokio::test]
async fn batch_update_member_status_rejects_invalid_status_values() {
    let repository = Arc::new(FakeTeamStore::default());
    let service = TeamService::new(
        repository.clone(),
        repository.clone(),
        Arc::new(FakeActivityRepository::default()),
    );

    let error = service
        .batch_update_member_status(&team_admin_principal(true), 1, &[11, 22], 2)
        .await
        .expect_err("非法状态值应被拒绝");

    assert!(matches!(error, TeamApplicationError::Validation(_)));
    assert!(
        repository.batch_update_calls.lock().unwrap().is_empty(),
        "非法状态值不应落库"
    );
}
