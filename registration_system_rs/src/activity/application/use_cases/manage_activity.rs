use crate::activity::application::commands::{CreateActivityCommand, UpdateActivityCommand};
use crate::activity::application::error::ActivityApplicationError;
use crate::activity::application::permission::ActivityPermissionChecker;
use crate::activity::application::principal::ActivityPrincipal;
use crate::activity::application::validation::{
    normalize_match_kind, validate_checkin_radius, validate_checkin_window_minutes,
    validate_location_coordinates, validate_location_coordinates_patch,
    validate_optional_hex_color, validate_optional_hex_color_patch,
};
use crate::activity::domain::{Activity, ActivityTeamCheckInConfig, UpdateActivityFields};
use crate::activity::ports::{ActivityCommandRepository, ActivityQueryRepository};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct ManageActivityUseCase {
    query_repository: Arc<dyn ActivityQueryRepository>,
    command_repository: Arc<dyn ActivityCommandRepository>,
    permission_checker: ActivityPermissionChecker,
}

impl ManageActivityUseCase {
    pub fn new(
        query_repository: Arc<dyn ActivityQueryRepository>,
        command_repository: Arc<dyn ActivityCommandRepository>,
        permission_checker: ActivityPermissionChecker,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            permission_checker,
        }
    }

    pub async fn create_activity(
        &self,
        actor: &ActivityPrincipal,
        command: CreateActivityCommand,
    ) -> Result<Activity, ActivityApplicationError> {
        if !actor.is_admin() {
            let home_team_id = command.home_team_id.ok_or_else(|| {
                ActivityApplicationError::Validation(
                    "普通用户创建比赛时必须指定当前球队".to_string(),
                )
            })?;

            self.permission_checker
                .ensure_team_manager(actor, home_team_id)
                .await?;
        }

        if command.name.trim().is_empty() {
            return Err(ActivityApplicationError::Validation(
                "活动名称不能为空".to_string(),
            ));
        }

        let color = validate_optional_hex_color(command.color, "球服颜色")?;
        let opposing_color = validate_optional_hex_color(command.opposing_color, "对手球服颜色")?;
        let match_kind = normalize_match_kind(command.match_kind)?;
        let (location_latitude, location_longitude) =
            validate_location_coordinates(command.location_latitude, command.location_longitude)?;

        let now = chrono::Local::now().naive_local();
        let activity = Activity {
            id: Uuid::new_v4().to_string(),
            cover: command.cover,
            start_time: command.start_time,
            end_time: command.end_time,
            holding_date: command.holding_date,
            location: command.location,
            location_latitude,
            location_longitude,
            name: command.name,
            opposing: command.opposing,
            status: 0,
            description: command.description,
            home_team_id: command.home_team_id,
            away_team_id: command.away_team_id,
            color,
            opposing_color,
            players_per_team: command.players_per_team,
            team_capacity_limit: command.team_capacity_limit,
            match_kind: Some(match_kind),
            source_activity_id: None,
            team_registration_count: None,
            registration_preview: Default::default(),
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        };

        self.command_repository
            .create(&activity)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("创建活动失败: {error}"))
            })?;

        // 自动为关联球队未冻结的成员创建默认报名记录（stand=0：未表态）
        self.command_repository
            .backfill_team_member_registrations(&activity.id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("自动回填球队成员报名失败: {error}"))
            })?;

        let mut created_checkin_configs = Vec::new();
        for config_command in &command.team_checkin_configs {
            let team_id = config_command.team_id;
            let participates =
                activity.home_team_id == Some(team_id) || activity.away_team_id == Some(team_id);
            if !participates {
                return Err(ActivityApplicationError::Validation(
                    "创建比赛时只能为参赛球队配置签到".to_string(),
                ));
            }

            if activity.location_latitude.is_none() || activity.location_longitude.is_none() {
                return Err(ActivityApplicationError::Validation(
                    "比赛还没有配置场地经纬度，暂时不能保存签到配置".to_string(),
                ));
            }

            let radius_meters = validate_checkin_radius(config_command.radius_meters)?;
            let (open_minutes_before, close_minutes_after) = validate_checkin_window_minutes(
                config_command.open_minutes_before,
                config_command.close_minutes_after,
            )?;

            let config = ActivityTeamCheckInConfig {
                activity_id: activity.id.clone(),
                team_id: config_command.team_id,
                enabled: config_command.enabled,
                radius_meters,
                open_minutes_before,
                close_minutes_after,
                updated_by_user_id: Some(actor.id),
                created_at: now,
                updated_at: now,
            };

            self.command_repository
                .upsert_team_checkin_config(&config)
                .await
                .map_err(|error| {
                    ActivityApplicationError::internal(format!("创建签到配置失败: {error}"))
                })?;
            created_checkin_configs.push(config);
        }

        let mut activity = activity;
        activity.team_checkin_configs = created_checkin_configs;
        Ok(activity)
    }

    pub async fn update_status(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        status: i8,
    ) -> Result<(), ActivityApplicationError> {
        self.permission_checker.ensure_admin(actor)?;

        self.command_repository
            .update_status(activity_id, status)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("更新活动状态失败: {error}"))
            })
    }

    pub async fn delete_activities(
        &self,
        actor: &ActivityPrincipal,
        ids: &[String],
    ) -> Result<(), ActivityApplicationError> {
        self.permission_checker.ensure_admin(actor)?;
        self.command_repository
            .delete_many(ids)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("批量删除活动失败: {error}"))
            })
    }

    pub async fn update_activity(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: UpdateActivityCommand,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_admin() {
            let activity = self
                .query_repository
                .find_by_id(activity_id)
                .await
                .map_err(|error| {
                    ActivityApplicationError::internal(format!("查询活动详情失败: {error}"))
                })?
                .ok_or_else(|| ActivityApplicationError::NotFound("活动不存在".to_string()))?;
            self.permission_checker
                .ensure_activity_manager_or_admin(actor, &activity)
                .await?;

            if chrono::Local::now().naive_local() >= activity.holding_date {
                return Err(ActivityApplicationError::Validation(
                    "比赛开始后不能修改比赛信息".to_string(),
                ));
            }
        }
        let color = validate_optional_hex_color_patch(command.color, "球服颜色")?;
        let opposing_color =
            validate_optional_hex_color_patch(command.opposing_color, "对手球服颜色")?;
        let (location_latitude, location_longitude) = validate_location_coordinates_patch(
            command.location_latitude,
            command.location_longitude,
        )?;
        self.command_repository
            .update_activity(
                activity_id,
                UpdateActivityFields {
                    name: command.name.as_deref(),
                    cover: command.cover.as_ref().map(|v| v.as_deref()),
                    start_time: command.start_time,
                    end_time: command.end_time,
                    holding_date: command.holding_date,
                    location: command.location.as_deref(),
                    location_latitude,
                    location_longitude,
                    opposing: command.opposing.as_ref().map(|v| v.as_deref()),
                    description: command.description.as_ref().map(|v| v.as_deref()),
                    home_team_id: command.home_team_id,
                    away_team_id: command.away_team_id,
                    color: color.as_ref().map(|v| v.as_deref()),
                    opposing_color: opposing_color.as_ref().map(|v| v.as_deref()),
                    players_per_team: command.players_per_team,
                    team_capacity_limit: command.team_capacity_limit,
                    match_kind: command.match_kind.as_deref(),
                    source_activity_id: None,
                    team_registration_count: None,
                },
            )
            .await
            .map_err(|error| ActivityApplicationError::internal(format!("更新活动失败: {error}")))
    }

    pub async fn backfill_activity(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
    ) -> Result<u64, ActivityApplicationError> {
        self.permission_checker.ensure_admin(actor)?;
        self.command_repository
            .backfill_team_member_registrations(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("回填活动报名失败: {error}"))
            })
    }
}
