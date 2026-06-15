use crate::activity::application::error::ActivityApplicationError;
use crate::activity::application::permission::{ActivityPermissionChecker, is_team_manager_role};
use crate::activity::application::principal::ActivityPrincipal;
use crate::activity::domain::{Activity, UpdateActivityFields};
use crate::activity::ports::{
    ActivityCommandRepository, ActivityQueryRepository, ActivityTeamAccessPort,
};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct TeamRegistrationUseCase {
    query_repository: Arc<dyn ActivityQueryRepository>,
    command_repository: Arc<dyn ActivityCommandRepository>,
    team_access_port: Arc<dyn ActivityTeamAccessPort>,
    permission_checker: ActivityPermissionChecker,
}

impl TeamRegistrationUseCase {
    pub fn new(
        query_repository: Arc<dyn ActivityQueryRepository>,
        command_repository: Arc<dyn ActivityCommandRepository>,
        team_access_port: Arc<dyn ActivityTeamAccessPort>,
        permission_checker: ActivityPermissionChecker,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            team_access_port,
            permission_checker,
        }
    }

    pub async fn update_team_registration(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        team_id: i64,
        registration_count: i32,
    ) -> Result<Activity, ActivityApplicationError> {
        self.permission_checker.ensure_user(actor)?;

        if !(5..=11).contains(&registration_count) {
            return Err(ActivityApplicationError::Validation(
                "活动人制必须在 5-11 之间".to_string(),
            ));
        }

        let source_activity = self.get_activity(activity_id).await?;

        let role = self
            .team_access_port
            .find_active_member_role(team_id, actor.id)
            .await
            .map_err(ActivityApplicationError::internal)?;

        if !role.as_deref().is_some_and(is_team_manager_role) {
            return Err(ActivityApplicationError::Forbidden);
        }

        if let Some(mut existing) = self
            .query_repository
            .find_derived_by_source_and_team(activity_id, team_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询球队报名活动失败: {error}"))
            })?
        {
            if existing.status == 3 {
                self.command_repository
                    .update_activity(
                        &existing.id,
                        UpdateActivityFields {
                            players_per_team: Some(Some(registration_count)),
                            team_registration_count: Some(Some(registration_count)),
                            ..UpdateActivityFields::default()
                        },
                    )
                    .await
                    .map_err(|error| {
                        ActivityApplicationError::internal(format!("重新发起球队报名失败: {error}"))
                    })?;
                self.command_repository
                    .update_status(&existing.id, source_activity.status)
                    .await
                    .map_err(|error| {
                        ActivityApplicationError::internal(format!("恢复球队报名状态失败: {error}"))
                    })?;
                existing.status = source_activity.status;
                existing.players_per_team = Some(registration_count);
                existing.team_registration_count = Some(registration_count);
                return Ok(existing);
            }
            return Err(ActivityApplicationError::Conflict(
                "当前球队已发起报名，请先取消后再重新发起".to_string(),
            ));
        }

        let now = chrono::Utc::now().naive_utc();
        let derived_activity = Activity {
            id: Uuid::new_v4().to_string(),
            cover: source_activity.cover.clone(),
            start_time: source_activity.start_time,
            end_time: source_activity.end_time,
            holding_date: source_activity.holding_date,
            location: source_activity.location.clone(),
            location_latitude: source_activity.location_latitude,
            location_longitude: source_activity.location_longitude,
            name: source_activity.name.clone(),
            opposing: source_activity.opposing.clone(),
            status: source_activity.status,
            description: source_activity.description.clone(),
            home_team_id: Some(team_id),
            away_team_id: None,
            color: source_activity.color.clone(),
            opposing_color: source_activity.opposing_color.clone(),
            players_per_team: Some(registration_count),
            team_capacity_limit: None,
            match_kind: source_activity.match_kind.clone(),
            source_activity_id: Some(source_activity.id.clone()),
            team_registration_count: Some(registration_count),
            registration_preview: Default::default(),
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        };

        self.command_repository
            .create(&derived_activity)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("创建球队报名活动失败: {error}"))
            })?;
        self.command_repository
            .backfill_team_member_registrations(&derived_activity.id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("自动回填球队成员报名失败: {error}"))
            })?;
        Ok(derived_activity)
    }

    pub async fn cancel_team_registration(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        team_id: i64,
    ) -> Result<(), ActivityApplicationError> {
        self.permission_checker.ensure_user(actor)?;

        let role = self
            .team_access_port
            .find_active_member_role(team_id, actor.id)
            .await
            .map_err(ActivityApplicationError::internal)?;

        if !role.as_deref().is_some_and(is_team_manager_role) {
            return Err(ActivityApplicationError::Forbidden);
        }

        let derived_activity = self
            .query_repository
            .find_derived_by_source_and_team(activity_id, team_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询球队报名活动失败: {error}"))
            })?
            .ok_or_else(|| ActivityApplicationError::NotFound("球队报名不存在".to_string()))?;

        self.command_repository
            .update_status(&derived_activity.id, 3)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("取消球队报名失败: {error}"))
            })?;
        Ok(())
    }

    async fn get_activity(&self, activity_id: &str) -> Result<Activity, ActivityApplicationError> {
        self.query_repository
            .find_by_id(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询活动详情失败: {error}"))
            })?
            .ok_or_else(|| ActivityApplicationError::NotFound("活动不存在".to_string()))
    }
}
