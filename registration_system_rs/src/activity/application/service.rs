use super::error::ActivityApplicationError;
use super::principal::ActivityPrincipal;
use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
    ActivityTeamCheckInConfig, RegistrationListPage, UpdateActivityFields,
};
use crate::activity::ports::{
    ActivityRepository, ActivityTeamAccessPort, LocationSearchGateway, LocationSearchResult,
};
use std::collections::BTreeSet;
use std::sync::Arc;
use uuid::Uuid;

type OptionalCoordinates = (Option<f64>, Option<f64>);
type OptionalCoordinatePatch = (Option<Option<f64>>, Option<Option<f64>>);

fn is_hex_color(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(|byte| byte.is_ascii_hexdigit())
}

fn validate_optional_hex_color(
    value: Option<String>,
    field_name: &str,
) -> Result<Option<String>, ActivityApplicationError> {
    match value {
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else if is_hex_color(trimmed) {
                Ok(Some(trimmed.to_ascii_uppercase()))
            } else {
                Err(ActivityApplicationError::Validation(format!(
                    "{field_name}必须是 #RRGGBB 格式"
                )))
            }
        }
        None => Ok(None),
    }
}

fn validate_optional_hex_color_patch(
    value: Option<Option<String>>,
    field_name: &str,
) -> Result<Option<Option<String>>, ActivityApplicationError> {
    match value {
        Some(value) => Ok(Some(validate_optional_hex_color(value, field_name)?)),
        None => Ok(None),
    }
}

fn validate_location_coordinates(
    latitude: Option<f64>,
    longitude: Option<f64>,
) -> Result<OptionalCoordinates, ActivityApplicationError> {
    match (latitude, longitude) {
        (None, None) => Ok((None, None)),
        (Some(_), None) | (None, Some(_)) => Err(ActivityApplicationError::Validation(
            "地点经纬度必须同时提供".to_string(),
        )),
        (Some(latitude), Some(longitude)) => {
            if !(-90.0..=90.0).contains(&latitude) {
                return Err(ActivityApplicationError::Validation(
                    "地点纬度超出有效范围".to_string(),
                ));
            }
            if !(-180.0..=180.0).contains(&longitude) {
                return Err(ActivityApplicationError::Validation(
                    "地点经度超出有效范围".to_string(),
                ));
            }
            Ok((Some(latitude), Some(longitude)))
        }
    }
}

fn validate_location_coordinates_patch(
    latitude: Option<Option<f64>>,
    longitude: Option<Option<f64>>,
) -> Result<OptionalCoordinatePatch, ActivityApplicationError> {
    match (latitude, longitude) {
        (None, None) => Ok((None, None)),
        (Some(_), None) | (None, Some(_)) => Err(ActivityApplicationError::Validation(
            "地点经纬度必须同时更新".to_string(),
        )),
        (Some(None), Some(None)) => Ok((Some(None), Some(None))),
        (Some(Some(latitude)), Some(Some(longitude))) => {
            let (latitude, longitude) =
                validate_location_coordinates(Some(latitude), Some(longitude))?;
            Ok((Some(latitude), Some(longitude)))
        }
        _ => Err(ActivityApplicationError::Validation(
            "地点经纬度必须同时提供或同时清空".to_string(),
        )),
    }
}

fn validate_checkin_radius(radius_meters: i32) -> Result<i32, ActivityApplicationError> {
    if !(50..=5000).contains(&radius_meters) {
        return Err(ActivityApplicationError::Validation(
            "签到半径必须在 50 到 5000 米之间".to_string(),
        ));
    }
    Ok(radius_meters)
}

fn validate_checkin_window_minutes(
    open_minutes_before: i32,
    close_minutes_after: i32,
) -> Result<(i32, i32), ActivityApplicationError> {
    if !(0..=1440).contains(&open_minutes_before) {
        return Err(ActivityApplicationError::Validation(
            "签到开放时间必须在比赛前 0 到 1440 分钟之间".to_string(),
        ));
    }
    if !(0..=1440).contains(&close_minutes_after) {
        return Err(ActivityApplicationError::Validation(
            "签到截止时间必须在比赛后 0 到 1440 分钟之间".to_string(),
        ));
    }
    Ok((open_minutes_before, close_minutes_after))
}

fn haversine_distance_meters(
    latitude_a: f64,
    longitude_a: f64,
    latitude_b: f64,
    longitude_b: f64,
) -> i32 {
    let earth_radius_meters = 6_371_000.0_f64;
    let lat_a = latitude_a.to_radians();
    let lat_b = latitude_b.to_radians();
    let delta_lat = (latitude_b - latitude_a).to_radians();
    let delta_lng = (longitude_b - longitude_a).to_radians();

    let sin_lat = (delta_lat / 2.0).sin();
    let sin_lng = (delta_lng / 2.0).sin();
    let a = sin_lat * sin_lat + lat_a.cos() * lat_b.cos() * sin_lng * sin_lng;
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    (earth_radius_meters * c).round() as i32
}

fn is_team_manager_role(role: &str) -> bool {
    matches!(role, "captain" | "leader")
}

fn is_capacity_stand(stand: i8) -> bool {
    matches!(stand, 1 | 3)
}

fn normalize_match_kind(value: Option<String>) -> Result<String, ActivityApplicationError> {
    match value
        .as_deref()
        .map(str::trim)
        .filter(|item| !item.is_empty())
    {
        None => Ok("external".to_string()),
        Some("external") => Ok("external".to_string()),
        Some("internal") => Ok("internal".to_string()),
        Some(_) => Err(ActivityApplicationError::Validation(
            "比赛类型必须是 external 或 internal".to_string(),
        )),
    }
}

#[cfg(test)]
fn is_frozen_during_activity(
    activity_holding_date: chrono::NaiveDateTime,
    freeze_start_time: Option<chrono::NaiveDateTime>,
    freeze_end_time: Option<chrono::NaiveDateTime>,
) -> bool {
    match freeze_start_time {
        Some(start) if start <= activity_holding_date => {
            freeze_end_time.is_none_or(|end| end >= activity_holding_date)
        }
        _ => false,
    }
}

#[derive(Debug, Clone)]
pub struct CreateActivityCommand {
    pub cover: Option<String>,
    pub start_time: chrono::NaiveDateTime,
    pub end_time: chrono::NaiveDateTime,
    pub holding_date: chrono::NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub name: String,
    pub opposing: Option<String>,
    pub description: Option<String>,
    pub home_team_id: Option<String>,
    pub away_team_id: Option<String>,
    pub color: Option<String>,
    pub opposing_color: Option<String>,
    pub players_per_team: Option<i32>,
    pub match_kind: Option<String>,
    pub team_checkin_configs: Vec<CreateActivityCheckInConfigCommand>,
}

#[derive(Debug, Clone)]
pub struct CreateActivityCheckInConfigCommand {
    pub team_id: String,
    pub enabled: bool,
    pub radius_meters: i32,
    pub open_minutes_before: i32,
    pub close_minutes_after: i32,
}

#[derive(Debug, Clone)]
pub struct UpdateMyStandCommand {
    pub stand: i8,
    pub registration_count: i32,
}

#[derive(Debug, Clone)]
pub struct UpdateActivityCommand {
    pub cover: Option<Option<String>>,
    pub start_time: Option<chrono::NaiveDateTime>,
    pub end_time: Option<chrono::NaiveDateTime>,
    pub holding_date: Option<chrono::NaiveDateTime>,
    pub location: Option<String>,
    pub location_latitude: Option<Option<f64>>,
    pub location_longitude: Option<Option<f64>>,
    pub name: Option<String>,
    pub opposing: Option<Option<String>>,
    pub description: Option<Option<String>>,
    pub home_team_id: Option<Option<String>>,
    pub away_team_id: Option<Option<String>>,
    pub color: Option<Option<String>>,
    pub opposing_color: Option<Option<String>>,
    pub players_per_team: Option<Option<i32>>,
    pub match_kind: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UpdateTeamCheckInConfigCommand {
    pub team_id: String,
    pub enabled: bool,
    pub radius_meters: i32,
    pub open_minutes_before: i32,
    pub close_minutes_after: i32,
}

#[derive(Debug, Clone)]
pub struct SubmitActivityCheckInCommand {
    pub team_id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub current_time: Option<chrono::NaiveDateTime>,
}

#[derive(Debug, Clone)]
pub struct OngoingActivityInfo {
    pub has_ongoing: bool,
    pub activity: Option<Activity>,
}

#[derive(Clone)]
pub struct ActivityService {
    repository: Arc<dyn ActivityRepository>,
    location_search_gateway: Option<Arc<dyn LocationSearchGateway>>,
    team_access_port: Arc<dyn ActivityTeamAccessPort>,
}

impl ActivityService {
    pub fn new(
        repository: Arc<dyn ActivityRepository>,
        location_search_gateway: Option<Arc<dyn LocationSearchGateway>>,
        team_access_port: Arc<dyn ActivityTeamAccessPort>,
    ) -> Self {
        Self {
            repository,
            location_search_gateway,
            team_access_port,
        }
    }

    pub async fn create_activity(
        &self,
        actor: &ActivityPrincipal,
        command: CreateActivityCommand,
    ) -> Result<Activity, ActivityApplicationError> {
        if !actor.is_admin() {
            let home_team_id = command.home_team_id.as_deref().ok_or_else(|| {
                ActivityApplicationError::Validation(
                    "普通用户创建比赛时必须指定当前球队".to_string(),
                )
            })?;

            if !actor.is_user() {
                return Err(ActivityApplicationError::Forbidden);
            }

            let role = self
                .team_access_port
                .find_active_member_role(home_team_id, actor.id)
                .await
                .map_err(ActivityApplicationError::internal)?;

            if !role.as_deref().is_some_and(is_team_manager_role) {
                return Err(ActivityApplicationError::Forbidden);
            }
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
            match_kind: Some(match_kind),
            source_activity_id: None,
            team_registration_count: None,
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        };

        self.repository.create(&activity).await.map_err(|error| {
            ActivityApplicationError::internal(format!("创建活动失败: {error}"))
        })?;

        // 自动为关联球队未冻结的成员创建默认报名记录（stand=0：未表态）
        self.repository
            .backfill_team_member_registrations(&activity.id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("自动回填球队成员报名失败: {error}"))
            })?;

        let mut created_checkin_configs = Vec::new();
        for config_command in &command.team_checkin_configs {
            let team_id = config_command.team_id.as_str();
            let participates = activity.home_team_id.as_deref() == Some(team_id)
                || activity.away_team_id.as_deref() == Some(team_id);
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
                team_id: config_command.team_id.clone(),
                enabled: config_command.enabled,
                radius_meters,
                open_minutes_before,
                close_minutes_after,
                updated_by_user_id: Some(actor.id),
                created_at: now,
                updated_at: now,
            };

            self.repository
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

    pub async fn list_activities(
        &self,
        status_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<ActivityListPage, ActivityApplicationError> {
        self.repository
            .list_page(status_filter, page, page_size)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询活动列表失败: {error}"))
            })
    }

    pub async fn search_locations(
        &self,
        actor: &ActivityPrincipal,
        keyword: &str,
        limit: u8,
    ) -> Result<Vec<LocationSearchResult>, ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }

        let keyword = keyword.trim();
        if keyword.is_empty() {
            return Err(ActivityApplicationError::Validation(
                "地点关键词不能为空".to_string(),
            ));
        }

        let gateway = self.location_search_gateway.as_ref().ok_or_else(|| {
            ActivityApplicationError::Internal(
                "地点搜索服务未配置，请在后端 .env 中设置 TENCENT_MAP_KEY 或 AMAP_WEB_KEY"
                    .to_string(),
            )
        })?;

        gateway
            .search_locations(keyword, limit.clamp(1, 10))
            .await
            .map_err(ActivityApplicationError::internal)
    }

    pub async fn resolve_location(
        &self,
        actor: &ActivityPrincipal,
        latitude: f64,
        longitude: f64,
    ) -> Result<LocationSearchResult, ActivityApplicationError> {
        let _ = actor;

        let (latitude, longitude) = validate_location_coordinates(Some(latitude), Some(longitude))?;

        let gateway = self.location_search_gateway.as_ref().ok_or_else(|| {
            ActivityApplicationError::Internal(
                "地点搜索服务未配置，请在后端 .env 中设置 TENCENT_MAP_KEY 或 AMAP_WEB_KEY"
                    .to_string(),
            )
        })?;

        gateway
            .resolve_location(
                latitude.expect("validated latitude should exist"),
                longitude.expect("validated longitude should exist"),
            )
            .await
            .map_err(ActivityApplicationError::internal)
    }

    pub async fn get_activity(
        &self,
        activity_id: &str,
    ) -> Result<Activity, ActivityApplicationError> {
        let mut activity = self
            .repository
            .find_by_id(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询活动详情失败: {error}"))
            })?
            .ok_or_else(|| ActivityApplicationError::NotFound("活动不存在".to_string()))?;

        activity.team_checkin_configs = self
            .repository
            .list_team_checkin_configs(&activity.id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询签到配置失败: {error}"))
            })?;

        Ok(activity)
    }

    pub async fn update_status(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        status: i8,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }

        self.repository
            .update_status(activity_id, status)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("更新活动状态失败: {error}"))
            })
    }

    pub async fn update_my_stand(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: UpdateMyStandCommand,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_user() {
            return Err(ActivityApplicationError::Forbidden);
        }

        if command.stand == 0 {
            self.repository
                .delete_registration(activity_id, actor.id)
                .await
                .map_err(|error| {
                    ActivityApplicationError::internal(format!("删除报名记录失败: {error}"))
                })?;
            return Ok(());
        }

        if is_capacity_stand(command.stand) {
            self.ensure_registration_capacity(activity_id, actor.id)
                .await?;
        }

        self.repository
            .upsert_registration(
                activity_id,
                actor.id,
                command.stand,
                command.registration_count,
            )
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("更新报名状态失败: {error}"))
            })
    }

    async fn ensure_registration_capacity(
        &self,
        activity_id: &str,
        user_id: i64,
    ) -> Result<(), ActivityApplicationError> {
        let activity = self.get_activity(activity_id).await?;
        let Some(required_players) = activity.players_per_team else {
            return Ok(());
        };
        let max_capacity = i64::from(required_players + 2);
        if max_capacity <= 0 {
            return Ok(());
        }

        let registrations = self
            .repository
            .list_registrations(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询报名状态失败: {error}"))
            })?;
        let current_user_already_counts = registrations
            .iter()
            .any(|item| item.user_id == user_id && is_capacity_stand(item.stand));
        if current_user_already_counts {
            return Ok(());
        }

        let current_count = self
            .repository
            .count_capacity_registrations(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("统计报名人数失败: {error}"))
            })?;
        if current_count >= max_capacity {
            return Err(ActivityApplicationError::Validation(
                "本场报名已满员".to_string(),
            ));
        }

        Ok(())
    }

    pub async fn update_user_stand(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_id: i64,
        command: UpdateMyStandCommand,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_admin() && actor.id != user_id {
            return Err(ActivityApplicationError::Forbidden);
        }

        self.repository
            .upsert_registration(
                activity_id,
                user_id,
                command.stand,
                command.registration_count,
            )
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("更新报名状态失败: {error}"))
            })
    }

    pub async fn list_activity_users(
        &self,
        activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, ActivityApplicationError> {
        self.repository
            .list_registrations(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询报名列表失败: {error}"))
            })
    }

    pub async fn delete_activities(
        &self,
        actor: &ActivityPrincipal,
        ids: &[String],
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        self.repository.delete_many(ids).await.map_err(|error| {
            ActivityApplicationError::internal(format!("批量删除活动失败: {error}"))
        })
    }

    pub async fn check_ongoing_activities(
        &self,
    ) -> Result<OngoingActivityInfo, ActivityApplicationError> {
        let activity = self
            .repository
            .find_ongoing_activity()
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("检查进行中活动失败: {error}"))
            })?;

        Ok(OngoingActivityInfo {
            has_ongoing: activity.is_some(),
            activity,
        })
    }

    pub async fn delete_user_registration(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_id: i64,
    ) -> Result<u64, ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        self.repository
            .delete_registration(activity_id, user_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("删除报名记录失败: {error}"))
            })
    }

    pub async fn update_activity(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: UpdateActivityCommand,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_admin() {
            if !actor.is_user() {
                return Err(ActivityApplicationError::Forbidden);
            }

            let activity = self.get_activity(activity_id).await?;
            if activity.source_activity_id.is_some() {
                return Err(ActivityApplicationError::Forbidden);
            }

            let home_team_id = activity
                .home_team_id
                .as_deref()
                .ok_or(ActivityApplicationError::Forbidden)?;
            let role = self
                .team_access_port
                .find_active_member_role(home_team_id, actor.id)
                .await
                .map_err(ActivityApplicationError::internal)?;

            if !role.as_deref().is_some_and(is_team_manager_role) {
                return Err(ActivityApplicationError::Forbidden);
            }

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
        self.repository
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
                    home_team_id: command.home_team_id.as_ref().map(|v| v.as_deref()),
                    away_team_id: command.away_team_id.as_ref().map(|v| v.as_deref()),
                    color: color.as_ref().map(|v| v.as_deref()),
                    opposing_color: opposing_color.as_ref().map(|v| v.as_deref()),
                    players_per_team: command.players_per_team,
                    match_kind: command.match_kind.as_deref(),
                    source_activity_id: None,
                    team_registration_count: None,
                },
            )
            .await
            .map_err(|error| ActivityApplicationError::internal(format!("更新活动失败: {error}")))
    }

    /// 管理后台：含球员信息的报名列表（分页，可选按 stand 筛选）
    pub async fn list_registrations_with_info(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        stand_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<RegistrationListPage, ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        let activity = self.get_activity(activity_id).await?;
        self.repository
            .list_registrations_with_info_page(
                activity_id,
                activity.holding_date,
                stand_filter,
                page,
                page_size,
            )
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询报名列表失败: {error}"))
            })
    }

    /// 管理员手动为球员报名
    pub async fn admin_register_user(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_id: i64,
        stand: i8,
        registration_count: i32,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        self.get_activity(activity_id).await?;
        self.repository
            .upsert_registration(activity_id, user_id, stand, registration_count)
            .await
            .map_err(|error| ActivityApplicationError::internal(format!("报名操作失败: {error}")))
    }

    /// 管理员批量修改报名状态
    pub async fn batch_update_user_stand(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_ids: &[i64],
        stand: i8,
        registration_count: i32,
    ) -> Result<u64, ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        if user_ids.is_empty() {
            return Ok(0);
        }
        self.get_activity(activity_id).await?;
        let unique_user_ids = user_ids.iter().copied().collect::<BTreeSet<_>>();
        for user_id in &unique_user_ids {
            self.repository
                .upsert_registration(activity_id, *user_id, stand, registration_count)
                .await
                .map_err(|error| {
                    ActivityApplicationError::internal(format!("批量更新报名状态失败: {error}"))
                })?;
        }
        Ok(unique_user_ids.len() as u64)
    }

    pub async fn update_team_registration(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        team_id: &str,
        registration_count: i32,
    ) -> Result<Activity, ActivityApplicationError> {
        if !actor.is_user() {
            return Err(ActivityApplicationError::Forbidden);
        }

        if !(5..=11).contains(&registration_count) {
            return Err(ActivityApplicationError::Validation(
                "比赛人制必须在 5-11 之间".to_string(),
            ));
        }

        let source_activity = self.get_activity(activity_id).await?;
        let trimmed_team_id = team_id.trim();
        if trimmed_team_id.is_empty() {
            return Err(ActivityApplicationError::Validation(
                "球队不能为空".to_string(),
            ));
        }

        let role = self
            .team_access_port
            .find_active_member_role(trimmed_team_id, actor.id)
            .await
            .map_err(ActivityApplicationError::internal)?;

        if !role.as_deref().is_some_and(is_team_manager_role) {
            return Err(ActivityApplicationError::Forbidden);
        }

        if let Some(mut existing) = self
            .repository
            .find_derived_by_source_and_team(activity_id, trimmed_team_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询球队报名比赛失败: {error}"))
            })?
        {
            if existing.status == 3 {
                self.repository
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
                self.repository
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
            home_team_id: Some(trimmed_team_id.to_string()),
            away_team_id: None,
            color: source_activity.color.clone(),
            opposing_color: source_activity.opposing_color.clone(),
            players_per_team: Some(registration_count),
            match_kind: source_activity.match_kind.clone(),
            source_activity_id: Some(source_activity.id.clone()),
            team_registration_count: Some(registration_count),
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        };

        self.repository
            .create(&derived_activity)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("创建球队报名比赛失败: {error}"))
            })?;
        self.repository
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
        team_id: &str,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_user() {
            return Err(ActivityApplicationError::Forbidden);
        }

        let trimmed_team_id = team_id.trim();
        if trimmed_team_id.is_empty() {
            return Err(ActivityApplicationError::Validation(
                "球队不能为空".to_string(),
            ));
        }

        let role = self
            .team_access_port
            .find_active_member_role(trimmed_team_id, actor.id)
            .await
            .map_err(ActivityApplicationError::internal)?;

        if !role.as_deref().is_some_and(is_team_manager_role) {
            return Err(ActivityApplicationError::Forbidden);
        }

        let derived_activity = self
            .repository
            .find_derived_by_source_and_team(activity_id, trimmed_team_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询球队报名比赛失败: {error}"))
            })?
            .ok_or_else(|| ActivityApplicationError::NotFound("球队报名不存在".to_string()))?;

        self.repository
            .update_status(&derived_activity.id, 3)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("取消球队报名失败: {error}"))
            })?;
        Ok(())
    }

    pub async fn backfill_activity(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
    ) -> Result<u64, ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        self.repository
            .backfill_team_member_registrations(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("回填活动报名失败: {error}"))
            })
    }

    pub async fn update_team_checkin_config(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: UpdateTeamCheckInConfigCommand,
    ) -> Result<ActivityTeamCheckInConfig, ActivityApplicationError> {
        let activity = self.get_activity(activity_id).await?;
        let team_id = command.team_id.trim();

        if activity.source_activity_id.is_some() {
            return Err(ActivityApplicationError::Validation(
                "球队报名比赛不配置现场签到".to_string(),
            ));
        }

        if team_id.is_empty() {
            return Err(ActivityApplicationError::Validation(
                "球队不能为空".to_string(),
            ));
        }

        let participates = activity.home_team_id.as_deref() == Some(team_id)
            || activity.away_team_id.as_deref() == Some(team_id);
        if !participates {
            return Err(ActivityApplicationError::Validation(
                "只有参赛球队才能配置签到".to_string(),
            ));
        }

        if !actor.is_admin() {
            if !actor.is_user() {
                return Err(ActivityApplicationError::Forbidden);
            }

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
            .repository
            .find_team_checkin_config(&activity.id, team_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询签到配置失败: {error}"))
            })?;

        let config = ActivityTeamCheckInConfig {
            activity_id: activity.id.clone(),
            team_id: team_id.to_string(),
            enabled: command.enabled,
            radius_meters,
            open_minutes_before,
            close_minutes_after,
            updated_by_user_id: Some(actor.id),
            created_at: existing.as_ref().map(|item| item.created_at).unwrap_or(now),
            updated_at: now,
        };

        self.repository
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
        if !actor.is_user() {
            return Err(ActivityApplicationError::Forbidden);
        }

        let activity = self.get_activity(activity_id).await?;
        let team_id = command.team_id.trim();
        if team_id.is_empty() {
            return Err(ActivityApplicationError::Validation(
                "球队不能为空".to_string(),
            ));
        }

        let participates = activity.home_team_id.as_deref() == Some(team_id)
            || activity.away_team_id.as_deref() == Some(team_id);
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
            .repository
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
            .repository
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
            team_id: team_id.to_string(),
            user_id: actor.id,
            latitude: latitude.expect("validated latitude should exist"),
            longitude: longitude.expect("validated longitude should exist"),
            distance_meters,
            checked_in_at: now,
            created_at: now,
            updated_at: now,
        };

        self.repository
            .record_checkin(&record)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("保存签到记录失败: {error}"))
            })
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ActivityService, CreateActivityCheckInConfigCommand, CreateActivityCommand,
        UpdateActivityCommand, UpdateMyStandCommand, is_frozen_during_activity, is_hex_color,
        validate_optional_hex_color,
    };
    use crate::activity::application::error::ActivityApplicationError;
    use crate::activity::application::principal::ActivityPrincipal;
    use crate::activity::domain::{
        Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
        ActivityTeamCheckInConfig, DomainError, RegistrationListPage, UpdateActivityFields,
    };
    use crate::activity::ports::{
        ActivityRepository, ActivityTeamAccessPort, LocationSearchGateway, LocationSearchResult,
    };
    use async_trait::async_trait;
    use chrono::{Duration, Utc};
    use std::sync::{Arc, Mutex};

    struct DummyActivityRepository;
    struct DummyTeamAccessPort;

    struct TeamManagerAccessPort;

    struct DummyLocationGateway;

    #[async_trait]
    impl LocationSearchGateway for DummyLocationGateway {
        async fn search_locations(
            &self,
            _keyword: &str,
            _limit: u8,
        ) -> Result<Vec<LocationSearchResult>, String> {
            Ok(vec![LocationSearchResult {
                provider_place_id: "poi-1".to_string(),
                title: "深圳湾体育中心".to_string(),
                address: "深圳市南山区滨海大道".to_string(),
                display_name: "深圳湾体育中心 · 深圳市南山区滨海大道".to_string(),
                latitude: "22.518014".to_string(),
                longitude: "113.947308".to_string(),
            }])
        }

        async fn resolve_location(
            &self,
            latitude: f64,
            longitude: f64,
        ) -> Result<LocationSearchResult, String> {
            Ok(LocationSearchResult {
                provider_place_id: "poi-resolved".to_string(),
                title: "腾讯滨海大厦".to_string(),
                address: "深圳市南山区科技南一路".to_string(),
                display_name: "腾讯滨海大厦 · 深圳市南山区科技南一路".to_string(),
                latitude: latitude.to_string(),
                longitude: longitude.to_string(),
            })
        }
    }

    #[async_trait]
    impl ActivityRepository for DummyActivityRepository {
        async fn create(&self, _activity: &Activity) -> Result<(), DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn list_page(
            &self,
            _status_filter: Option<i8>,
            _page: u32,
            _page_size: u32,
        ) -> Result<ActivityListPage, DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn find_by_id(&self, _activity_id: &str) -> Result<Option<Activity>, DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn find_derived_by_source_and_team(
            &self,
            _source_activity_id: &str,
            _team_id: &str,
        ) -> Result<Option<Activity>, DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn delete_many(&self, _ids: &[String]) -> Result<(), DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn update_status(&self, _activity_id: &str, _status: i8) -> Result<(), DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn update_activity(
            &self,
            _activity_id: &str,
            _fields: UpdateActivityFields<'_>,
        ) -> Result<(), DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn find_ongoing_activity(&self) -> Result<Option<Activity>, DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn upsert_registration(
            &self,
            _activity_id: &str,
            _user_id: i64,
            _stand: i8,
            _registration_count: i32,
        ) -> Result<(), DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn delete_registration(
            &self,
            _activity_id: &str,
            _user_id: i64,
        ) -> Result<u64, DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn backfill_team_member_registrations(
            &self,
            _activity_id: &str,
        ) -> Result<u64, DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn list_registrations(
            &self,
            _activity_id: &str,
        ) -> Result<Vec<ActivityRegistration>, DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn count_capacity_registrations(
            &self,
            _activity_id: &str,
        ) -> Result<i64, DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn list_registrations_with_info_page(
            &self,
            _activity_id: &str,
            _activity_holding_date: chrono::NaiveDateTime,
            _stand_filter: Option<i8>,
            _page: u32,
            _page_size: u32,
        ) -> Result<RegistrationListPage, DomainError> {
            unreachable!("search_locations does not use repository")
        }

        async fn list_team_checkin_configs(
            &self,
            _activity_id: &str,
        ) -> Result<Vec<ActivityTeamCheckInConfig>, DomainError> {
            Ok(Vec::new())
        }

        async fn upsert_team_checkin_config(
            &self,
            _config: &ActivityTeamCheckInConfig,
        ) -> Result<(), DomainError> {
            Ok(())
        }

        async fn find_team_checkin_config(
            &self,
            _activity_id: &str,
            _team_id: &str,
        ) -> Result<Option<ActivityTeamCheckInConfig>, DomainError> {
            Ok(None)
        }

        async fn record_checkin(
            &self,
            record: &ActivityCheckInRecord,
        ) -> Result<ActivityCheckInRecord, DomainError> {
            Ok(record.clone())
        }

        async fn find_checkin_record(
            &self,
            _activity_id: &str,
            _team_id: &str,
            _user_id: i64,
        ) -> Result<Option<ActivityCheckInRecord>, DomainError> {
            Ok(None)
        }
    }

    #[async_trait]
    impl ActivityTeamAccessPort for DummyTeamAccessPort {
        async fn find_active_member_role(
            &self,
            _team_id: &str,
            _user_id: i64,
        ) -> Result<Option<String>, String> {
            Ok(None)
        }
    }

    #[async_trait]
    impl ActivityTeamAccessPort for TeamManagerAccessPort {
        async fn find_active_member_role(
            &self,
            _team_id: &str,
            _user_id: i64,
        ) -> Result<Option<String>, String> {
            Ok(Some("captain".to_string()))
        }
    }

    #[derive(Default)]
    struct RecordingActivityRepository {
        created: Mutex<Vec<Activity>>,
        found_activity: Mutex<Option<Activity>>,
        derived_activity: Mutex<Option<Activity>>,
        updated: Mutex<Vec<RecordedUpdate>>,
        status_updates: Mutex<Vec<(String, i8)>>,
        upserted_registrations: Mutex<Vec<RecordedRegistration>>,
        deleted_registrations: Mutex<Vec<(String, i64)>>,
        created_checkin_configs: Mutex<Vec<ActivityTeamCheckInConfig>>,
    }

    #[derive(Debug, Clone, PartialEq)]
    struct RecordedUpdate {
        activity_id: String,
        location_latitude: Option<Option<f64>>,
        location_longitude: Option<Option<f64>>,
        players_per_team: Option<Option<i32>>,
        match_kind: Option<String>,
        team_registration_count: Option<Option<i32>>,
    }

    #[derive(Debug, Clone, PartialEq)]
    struct RecordedRegistration {
        activity_id: String,
        user_id: i64,
        stand: i8,
        registration_count: i32,
    }

    #[async_trait]
    impl ActivityRepository for RecordingActivityRepository {
        async fn create(&self, activity: &Activity) -> Result<(), DomainError> {
            self.created
                .lock()
                .expect("created mutex poisoned")
                .push(activity.clone());
            Ok(())
        }

        async fn list_page(
            &self,
            _status_filter: Option<i8>,
            _page: u32,
            _page_size: u32,
        ) -> Result<ActivityListPage, DomainError> {
            unreachable!("not used in this test")
        }

        async fn find_by_id(&self, _activity_id: &str) -> Result<Option<Activity>, DomainError> {
            Ok(self
                .found_activity
                .lock()
                .expect("found_activity mutex poisoned")
                .clone())
        }

        async fn find_derived_by_source_and_team(
            &self,
            _source_activity_id: &str,
            _team_id: &str,
        ) -> Result<Option<Activity>, DomainError> {
            Ok(self
                .derived_activity
                .lock()
                .expect("derived_activity mutex poisoned")
                .clone())
        }

        async fn delete_many(&self, _ids: &[String]) -> Result<(), DomainError> {
            unreachable!("not used in this test")
        }

        async fn update_status(&self, _activity_id: &str, _status: i8) -> Result<(), DomainError> {
            self.status_updates
                .lock()
                .expect("status_updates mutex poisoned")
                .push((_activity_id.to_string(), _status));
            Ok(())
        }

        async fn update_activity(
            &self,
            activity_id: &str,
            fields: UpdateActivityFields<'_>,
        ) -> Result<(), DomainError> {
            self.updated
                .lock()
                .expect("updated mutex poisoned")
                .push(RecordedUpdate {
                    activity_id: activity_id.to_string(),
                    location_latitude: fields.location_latitude,
                    location_longitude: fields.location_longitude,
                    players_per_team: fields.players_per_team,
                    match_kind: fields.match_kind.map(str::to_string),
                    team_registration_count: fields.team_registration_count,
                });
            Ok(())
        }

        async fn find_ongoing_activity(&self) -> Result<Option<Activity>, DomainError> {
            unreachable!("not used in this test")
        }

        async fn upsert_registration(
            &self,
            activity_id: &str,
            user_id: i64,
            stand: i8,
            registration_count: i32,
        ) -> Result<(), DomainError> {
            self.upserted_registrations
                .lock()
                .expect("upserted_registrations mutex poisoned")
                .push(RecordedRegistration {
                    activity_id: activity_id.to_string(),
                    user_id,
                    stand,
                    registration_count,
                });
            Ok(())
        }

        async fn delete_registration(
            &self,
            activity_id: &str,
            user_id: i64,
        ) -> Result<u64, DomainError> {
            self.deleted_registrations
                .lock()
                .expect("deleted_registrations mutex poisoned")
                .push((activity_id.to_string(), user_id));
            Ok(1)
        }

        async fn backfill_team_member_registrations(
            &self,
            _activity_id: &str,
        ) -> Result<u64, DomainError> {
            Ok(0)
        }

        async fn list_registrations(
            &self,
            _activity_id: &str,
        ) -> Result<Vec<ActivityRegistration>, DomainError> {
            Ok(Vec::new())
        }

        async fn count_capacity_registrations(
            &self,
            _activity_id: &str,
        ) -> Result<i64, DomainError> {
            Ok(0)
        }

        async fn list_registrations_with_info_page(
            &self,
            _activity_id: &str,
            _activity_holding_date: chrono::NaiveDateTime,
            _stand_filter: Option<i8>,
            _page: u32,
            _page_size: u32,
        ) -> Result<RegistrationListPage, DomainError> {
            unreachable!("not used in this test")
        }

        async fn list_team_checkin_configs(
            &self,
            _activity_id: &str,
        ) -> Result<Vec<ActivityTeamCheckInConfig>, DomainError> {
            Ok(Vec::new())
        }

        async fn upsert_team_checkin_config(
            &self,
            config: &ActivityTeamCheckInConfig,
        ) -> Result<(), DomainError> {
            self.created_checkin_configs
                .lock()
                .expect("created_checkin_configs mutex poisoned")
                .push(config.clone());
            Ok(())
        }

        async fn find_team_checkin_config(
            &self,
            _activity_id: &str,
            _team_id: &str,
        ) -> Result<Option<ActivityTeamCheckInConfig>, DomainError> {
            Ok(None)
        }

        async fn record_checkin(
            &self,
            record: &ActivityCheckInRecord,
        ) -> Result<ActivityCheckInRecord, DomainError> {
            Ok(record.clone())
        }

        async fn find_checkin_record(
            &self,
            _activity_id: &str,
            _team_id: &str,
            _user_id: i64,
        ) -> Result<Option<ActivityCheckInRecord>, DomainError> {
            Ok(None)
        }
    }

    #[test]
    fn accepts_valid_hex_colors() {
        assert!(is_hex_color("#A1B2C3"));
        assert_eq!(
            validate_optional_hex_color(Some("#a1b2c3".to_string()), "球服颜色").unwrap(),
            Some("#A1B2C3".to_string())
        );
    }

    #[test]
    fn treats_blank_hex_colors_as_none() {
        assert_eq!(
            validate_optional_hex_color(Some("   ".to_string()), "球服颜色").unwrap(),
            None
        );
    }

    #[test]
    fn rejects_invalid_hex_colors() {
        assert_eq!(
            validate_optional_hex_color(Some("white".to_string()), "球服颜色"),
            Err(ActivityApplicationError::Validation(
                "球服颜色必须是 #RRGGBB 格式".to_string()
            ))
        );
    }

    #[test]
    fn detects_user_as_frozen_when_holding_date_is_inside_freeze_window() {
        let holding_date = Utc::now().naive_utc();

        assert!(is_frozen_during_activity(
            holding_date,
            Some(holding_date - Duration::hours(2)),
            Some(holding_date + Duration::hours(2)),
        ));
    }

    #[test]
    fn detects_user_as_not_frozen_when_holding_date_is_outside_freeze_window() {
        let holding_date = Utc::now().naive_utc();

        assert!(!is_frozen_during_activity(
            holding_date,
            Some(holding_date + Duration::hours(1)),
            Some(holding_date + Duration::hours(3)),
        ));
        assert!(!is_frozen_during_activity(
            holding_date,
            Some(holding_date - Duration::hours(3)),
            Some(holding_date - Duration::hours(1)),
        ));
    }

    #[test]
    fn treats_open_ended_freeze_as_covering_future_activity_dates() {
        let holding_date = Utc::now().naive_utc();

        assert!(is_frozen_during_activity(
            holding_date,
            Some(holding_date - Duration::days(1)),
            None,
        ));
    }

    #[tokio::test]
    async fn returns_actionable_error_when_location_gateway_is_not_configured() {
        let service = ActivityService::new(
            Arc::new(DummyActivityRepository),
            None,
            Arc::new(DummyTeamAccessPort),
        );
        let error = service
            .search_locations(&ActivityPrincipal::admin(1, true), "迟到", 8)
            .await
            .expect_err("expected missing gateway to fail");

        assert_eq!(
            error,
            ActivityApplicationError::Internal(
                "地点搜索服务未配置，请在后端 .env 中设置 TENCENT_MAP_KEY 或 AMAP_WEB_KEY"
                    .to_string()
            )
        );
    }

    #[tokio::test]
    async fn update_my_stand_zero_deletes_current_user_registration() {
        let repository = Arc::new(RecordingActivityRepository::default());
        let service = ActivityService::new(repository.clone(), None, Arc::new(DummyTeamAccessPort));

        service
            .update_my_stand(
                &ActivityPrincipal::user(7),
                "activity-1",
                UpdateMyStandCommand {
                    stand: 0,
                    registration_count: 0,
                },
            )
            .await
            .expect("cancel should succeed");

        assert_eq!(
            repository
                .deleted_registrations
                .lock()
                .expect("deleted_registrations mutex poisoned")
                .as_slice(),
            &[("activity-1".to_string(), 7)]
        );
        assert!(
            repository
                .upserted_registrations
                .lock()
                .expect("upserted_registrations mutex poisoned")
                .is_empty()
        );
    }

    #[tokio::test]
    async fn update_my_stand_attending_upserts_current_user_registration() {
        let repository = Arc::new(RecordingActivityRepository::default());
        let now = Utc::now().naive_utc();
        *repository
            .found_activity
            .lock()
            .expect("found_activity mutex poisoned") = Some(Activity {
            id: "activity-1".to_string(),
            cover: None,
            start_time: now,
            end_time: now + Duration::hours(2),
            holding_date: now,
            location: "测试球场".to_string(),
            location_latitude: None,
            location_longitude: None,
            name: "测试比赛".to_string(),
            opposing: None,
            status: 0,
            description: None,
            home_team_id: None,
            away_team_id: None,
            color: None,
            opposing_color: None,
            players_per_team: Some(7),
            match_kind: Some("external".to_string()),
            source_activity_id: None,
            team_registration_count: None,
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        });
        let service = ActivityService::new(repository.clone(), None, Arc::new(DummyTeamAccessPort));

        service
            .update_my_stand(
                &ActivityPrincipal::user(7),
                "activity-1",
                UpdateMyStandCommand {
                    stand: 1,
                    registration_count: 1,
                },
            )
            .await
            .expect("signup should succeed");

        assert_eq!(
            repository
                .upserted_registrations
                .lock()
                .expect("upserted_registrations mutex poisoned")
                .as_slice(),
            &[RecordedRegistration {
                activity_id: "activity-1".to_string(),
                user_id: 7,
                stand: 1,
                registration_count: 1,
            }]
        );
        assert!(
            repository
                .deleted_registrations
                .lock()
                .expect("deleted_registrations mutex poisoned")
                .is_empty()
        );
    }

    #[tokio::test]
    async fn cancel_team_registration_marks_derived_activity_cancelled() {
        let repository = Arc::new(RecordingActivityRepository::default());
        let now = Utc::now().naive_utc();
        *repository
            .derived_activity
            .lock()
            .expect("derived_activity mutex poisoned") = Some(Activity {
            id: "derived-1".to_string(),
            cover: None,
            start_time: now,
            end_time: now + Duration::hours(2),
            holding_date: now,
            location: "测试球场".to_string(),
            location_latitude: None,
            location_longitude: None,
            name: "队内报名".to_string(),
            opposing: None,
            status: 0,
            description: None,
            home_team_id: Some("team-1".to_string()),
            away_team_id: None,
            color: None,
            opposing_color: None,
            players_per_team: Some(7),
            match_kind: Some("external".to_string()),
            source_activity_id: Some("activity-1".to_string()),
            team_registration_count: Some(7),
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        });
        let service =
            ActivityService::new(repository.clone(), None, Arc::new(TeamManagerAccessPort));

        service
            .cancel_team_registration(&ActivityPrincipal::user(7), "activity-1", "team-1")
            .await
            .expect("cancel should succeed");

        assert_eq!(
            repository
                .status_updates
                .lock()
                .expect("status_updates mutex poisoned")
                .as_slice(),
            &[("derived-1".to_string(), 3)]
        );
    }

    #[tokio::test]
    async fn create_activity_persists_location_coordinates() {
        let repository = Arc::new(RecordingActivityRepository::default());
        let service = ActivityService::new(repository.clone(), None, Arc::new(DummyTeamAccessPort));
        let now = Utc::now().naive_utc();

        let activity = service
            .create_activity(
                &ActivityPrincipal::admin(1, true),
                CreateActivityCommand {
                    cover: None,
                    start_time: now,
                    end_time: now + Duration::hours(2),
                    holding_date: now + Duration::days(1),
                    location: "深圳湾体育中心".to_string(),
                    location_latitude: Some(22.518014),
                    location_longitude: Some(113.947308),
                    name: "周四友谊赛".to_string(),
                    opposing: None,
                    description: None,
                    home_team_id: None,
                    away_team_id: None,
                    color: None,
                    opposing_color: None,
                    players_per_team: None,
                    match_kind: None,
                    team_checkin_configs: vec![],
                },
            )
            .await
            .expect("create should succeed");

        let created = repository.created.lock().expect("created mutex poisoned");
        assert_eq!(created.len(), 1);
        assert_eq!(created[0].id, activity.id);
        assert_eq!(created[0].location_latitude, Some(22.518014));
        assert_eq!(created[0].location_longitude, Some(113.947308));
    }

    #[tokio::test]
    async fn create_activity_persists_match_kind() {
        let repository = Arc::new(RecordingActivityRepository::default());
        let service = ActivityService::new(repository.clone(), None, Arc::new(DummyTeamAccessPort));
        let now = Utc::now().naive_utc();

        let activity = service
            .create_activity(
                &ActivityPrincipal::admin(1, true),
                CreateActivityCommand {
                    cover: None,
                    start_time: now,
                    end_time: now + Duration::hours(2),
                    holding_date: now + Duration::days(1),
                    location: "深圳湾体育中心".to_string(),
                    location_latitude: None,
                    location_longitude: None,
                    name: "队内训练赛".to_string(),
                    opposing: None,
                    description: None,
                    home_team_id: None,
                    away_team_id: None,
                    color: None,
                    opposing_color: None,
                    players_per_team: None,
                    match_kind: Some("internal".to_string()),
                    team_checkin_configs: vec![],
                },
            )
            .await
            .expect("create should succeed");

        assert_eq!(activity.match_kind.as_deref(), Some("internal"));
        let created = repository.created.lock().expect("created mutex poisoned");
        assert_eq!(created[0].match_kind.as_deref(), Some("internal"));
    }

    #[tokio::test]
    async fn team_manager_can_create_activity_with_initial_checkin_config() {
        let repository = Arc::new(RecordingActivityRepository::default());
        let service =
            ActivityService::new(repository.clone(), None, Arc::new(TeamManagerAccessPort));
        let now = Utc::now().naive_utc();

        let activity = service
            .create_activity(
                &ActivityPrincipal::user(7),
                CreateActivityCommand {
                    cover: None,
                    start_time: now,
                    end_time: now + Duration::hours(2),
                    holding_date: now + Duration::days(1),
                    location: "深圳湾体育中心".to_string(),
                    location_latitude: Some(22.518014),
                    location_longitude: Some(113.947308),
                    name: "队长发起的周四友谊赛".to_string(),
                    opposing: None,
                    description: None,
                    home_team_id: Some("team-1".to_string()),
                    away_team_id: None,
                    color: None,
                    opposing_color: None,
                    players_per_team: Some(8),
                    match_kind: None,
                    team_checkin_configs: vec![CreateActivityCheckInConfigCommand {
                        team_id: "team-1".to_string(),
                        enabled: true,
                        radius_meters: 200,
                        open_minutes_before: 60,
                        close_minutes_after: 45,
                    }],
                },
            )
            .await
            .expect("create should succeed");

        assert_eq!(activity.team_checkin_configs.len(), 1);
        assert_eq!(activity.team_checkin_configs[0].team_id, "team-1");
        assert!(activity.team_checkin_configs[0].enabled);

        let created_configs = repository
            .created_checkin_configs
            .lock()
            .expect("created_checkin_configs mutex poisoned");
        assert_eq!(created_configs.len(), 1);
        assert_eq!(created_configs[0].activity_id, activity.id);
        assert_eq!(created_configs[0].radius_meters, 200);
    }

    #[tokio::test]
    async fn resolves_location_name_from_coordinates() {
        let service = ActivityService::new(
            Arc::new(DummyActivityRepository),
            Some(Arc::new(DummyLocationGateway)),
            Arc::new(DummyTeamAccessPort),
        );

        let resolved = service
            .resolve_location(&ActivityPrincipal::admin(1, true), 22.5401, 113.9345)
            .await
            .expect("resolve should succeed");

        assert_eq!(resolved.title, "腾讯滨海大厦");
        assert_eq!(resolved.latitude, "22.5401");
        assert_eq!(resolved.longitude, "113.9345");
    }

    #[tokio::test]
    async fn app_user_can_resolve_location_name_from_coordinates() {
        let service = ActivityService::new(
            Arc::new(DummyActivityRepository),
            Some(Arc::new(DummyLocationGateway)),
            Arc::new(DummyTeamAccessPort),
        );

        let resolved = service
            .resolve_location(&ActivityPrincipal::user(7), 22.5401, 113.9345)
            .await
            .expect("app user resolve should succeed");

        assert_eq!(resolved.title, "腾讯滨海大厦");
        assert_eq!(resolved.latitude, "22.5401");
        assert_eq!(resolved.longitude, "113.9345");
    }

    #[tokio::test]
    async fn update_activity_can_clear_location_coordinates() {
        let repository = Arc::new(RecordingActivityRepository::default());
        let service = ActivityService::new(repository.clone(), None, Arc::new(DummyTeamAccessPort));

        service
            .update_activity(
                &ActivityPrincipal::admin(1, true),
                "activity-1",
                UpdateActivityCommand {
                    cover: None,
                    start_time: None,
                    end_time: None,
                    holding_date: None,
                    location: None,
                    location_latitude: Some(None),
                    location_longitude: Some(None),
                    name: None,
                    opposing: None,
                    description: None,
                    home_team_id: None,
                    away_team_id: None,
                    color: None,
                    opposing_color: None,
                    players_per_team: None,
                    match_kind: None,
                },
            )
            .await
            .expect("update should succeed");

        let updated = repository.updated.lock().expect("updated mutex poisoned");
        assert_eq!(
            updated[0],
            RecordedUpdate {
                activity_id: "activity-1".to_string(),
                location_latitude: Some(None),
                location_longitude: Some(None),
                players_per_team: None,
                match_kind: None,
                team_registration_count: None,
            }
        );
    }

    #[tokio::test]
    async fn team_manager_can_update_own_future_activity() {
        let repository = Arc::new(RecordingActivityRepository::default());
        let now = Utc::now().naive_utc();
        *repository
            .found_activity
            .lock()
            .expect("found_activity mutex poisoned") = Some(Activity {
            id: "activity-1".to_string(),
            cover: None,
            start_time: now + Duration::days(1),
            end_time: now + Duration::days(1) + Duration::hours(2),
            holding_date: now + Duration::days(1),
            location: "旧球场".to_string(),
            location_latitude: None,
            location_longitude: None,
            name: "旧比赛".to_string(),
            opposing: None,
            status: 0,
            description: None,
            home_team_id: Some("team-1".to_string()),
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
        });
        let service =
            ActivityService::new(repository.clone(), None, Arc::new(TeamManagerAccessPort));

        service
            .update_activity(
                &ActivityPrincipal::user(7),
                "activity-1",
                UpdateActivityCommand {
                    cover: None,
                    start_time: Some(now + Duration::days(2)),
                    end_time: Some(now + Duration::days(2) + Duration::hours(2)),
                    holding_date: Some(now + Duration::days(2)),
                    location: Some("新球场".to_string()),
                    location_latitude: Some(Some(22.1)),
                    location_longitude: Some(Some(113.9)),
                    name: Some("新比赛".to_string()),
                    opposing: Some(Some("新对手".to_string())),
                    description: None,
                    home_team_id: None,
                    away_team_id: None,
                    color: Some(Some("#2f6bff".to_string())),
                    opposing_color: Some(Some("#d9ff16".to_string())),
                    players_per_team: Some(Some(8)),
                    match_kind: Some("external".to_string()),
                },
            )
            .await
            .expect("team manager should update own future activity");

        let updated = repository.updated.lock().expect("updated mutex poisoned");
        assert_eq!(updated.len(), 1);
        assert_eq!(updated[0].activity_id, "activity-1");
        assert_eq!(updated[0].match_kind.as_deref(), Some("external"));
    }
}
