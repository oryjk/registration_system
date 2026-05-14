use crate::activity::application::commands::{
    SubmitActivityCheckInCommand, UpdateTeamCheckInConfigCommand,
};
use crate::activity::application::error::ActivityApplicationError;
use crate::activity::application::permission::{ActivityPermissionChecker, is_team_manager_role};
use crate::activity::application::principal::ActivityPrincipal;
use crate::activity::application::validation::{
    haversine_distance_meters, validate_checkin_radius, validate_checkin_window_minutes,
    validate_location_coordinates,
};
use crate::activity::domain::{Activity, ActivityCheckInRecord, ActivityTeamCheckInConfig};
use crate::activity::ports::{
    ActivityCommandRepository, ActivityQueryRepository, ActivityTeamAccessPort,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct ActivityCheckInUseCase {
    query_repository: Arc<dyn ActivityQueryRepository>,
    command_repository: Arc<dyn ActivityCommandRepository>,
    team_access_port: Arc<dyn ActivityTeamAccessPort>,
    permission_checker: ActivityPermissionChecker,
}

impl ActivityCheckInUseCase {
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

    pub async fn update_team_checkin_config(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: UpdateTeamCheckInConfigCommand,
    ) -> Result<ActivityTeamCheckInConfig, ActivityApplicationError> {
        let activity = self.get_activity(activity_id).await?;
        let team_id = command.team_id;

        if activity.source_activity_id.is_some() {
            return Err(ActivityApplicationError::Validation(
                "球队报名比赛不配置现场签到".to_string(),
            ));
        }

        let participates =
            activity.home_team_id == Some(team_id) || activity.away_team_id == Some(team_id);
        if !participates {
            return Err(ActivityApplicationError::Validation(
                "只有参赛球队才能配置签到".to_string(),
            ));
        }

        if !actor.is_admin() {
            self.permission_checker.ensure_user(actor)?;

            let role = self
                .team_access_port
                .find_active_member_role(team_id, actor.id)
                .await
                .map_err(ActivityApplicationError::internal)?;

            if !role.as_deref().is_some_and(is_team_manager_role) {
                return Err(ActivityApplicationError::Forbidden);
            }
        }

        if activity.location_latitude.is_none() || activity.location_longitude.is_none() {
            return Err(ActivityApplicationError::Validation(
                "比赛还没有配置场地经纬度，暂时不能开启签到".to_string(),
            ));
        }

        let radius_meters = validate_checkin_radius(command.radius_meters)?;
        let (open_minutes_before, close_minutes_after) = validate_checkin_window_minutes(
            command.open_minutes_before,
            command.close_minutes_after,
        )?;

        let now = chrono::Local::now().naive_local();
        let existing = self
            .query_repository
            .find_team_checkin_config(&activity.id, team_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询签到配置失败: {error}"))
            })?;

        let config = ActivityTeamCheckInConfig {
            activity_id: activity.id.clone(),
            team_id,
            enabled: command.enabled,
            radius_meters,
            open_minutes_before,
            close_minutes_after,
            updated_by_user_id: Some(actor.id),
            created_at: existing.as_ref().map(|item| item.created_at).unwrap_or(now),
            updated_at: now,
        };

        self.command_repository
            .upsert_team_checkin_config(&config)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("保存签到配置失败: {error}"))
            })?;

        Ok(config)
    }

    pub async fn submit_check_in(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: SubmitActivityCheckInCommand,
    ) -> Result<ActivityCheckInRecord, ActivityApplicationError> {
        self.permission_checker.ensure_user(actor)?;

        let activity = self.get_activity(activity_id).await?;
        let team_id = command.team_id;

        let participates =
            activity.home_team_id == Some(team_id) || activity.away_team_id == Some(team_id);
        if !participates {
            return Err(ActivityApplicationError::Validation(
                "只有参赛球队成员才能签到".to_string(),
            ));
        }

        let role = self
            .team_access_port
            .find_active_member_role(team_id, actor.id)
            .await
            .map_err(ActivityApplicationError::internal)?;
        if role.is_none() {
            return Err(ActivityApplicationError::Forbidden);
        }

        let config = self
            .query_repository
            .find_team_checkin_config(&activity.id, team_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询签到配置失败: {error}"))
            })?
            .ok_or_else(|| {
                ActivityApplicationError::Validation("当前球队未启用签到".to_string())
            })?;

        if !config.enabled {
            return Err(ActivityApplicationError::Validation(
                "当前球队未启用签到".to_string(),
            ));
        }

        let (location_latitude, location_longitude) =
            validate_location_coordinates(activity.location_latitude, activity.location_longitude)?;

        let (latitude, longitude) =
            validate_location_coordinates(Some(command.latitude), Some(command.longitude))?;

        let now = {
            command
                .current_time
                .unwrap_or_else(|| chrono::Local::now().naive_local())
        };

        let open_at = config.checkin_open_at(activity.holding_date);
        let close_at = config.checkin_close_at(activity.holding_date);
        if now < open_at {
            return Err(ActivityApplicationError::Validation(
                "签到尚未开放".to_string(),
            ));
        }
        if now > close_at {
            return Err(ActivityApplicationError::Validation(
                "签到时间已截止".to_string(),
            ));
        }

        if self
            .query_repository
            .find_checkin_record(&activity.id, team_id, actor.id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询签到记录失败: {error}"))
            })?
            .is_some()
        {
            return Err(ActivityApplicationError::Conflict(
                "你已签到，请勿重复提交".to_string(),
            ));
        }

        let distance_meters = haversine_distance_meters(
            location_latitude.expect("validated latitude should exist"),
            location_longitude.expect("validated longitude should exist"),
            latitude.expect("validated latitude should exist"),
            longitude.expect("validated longitude should exist"),
        );

        if distance_meters > config.radius_meters {
            return Err(ActivityApplicationError::Validation(format!(
                "当前定位超出签到范围（距球场 {distance_meters} 米）"
            )));
        }

        let record = ActivityCheckInRecord {
            id: 0,
            activity_id: activity.id,
            team_id,
            user_id: actor.id,
            latitude: latitude.expect("validated latitude should exist"),
            longitude: longitude.expect("validated longitude should exist"),
            distance_meters,
            checked_in_at: now,
            created_at: now,
            updated_at: now,
        };

        self.command_repository
            .record_checkin(&record)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("保存签到记录失败: {error}"))
            })
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
