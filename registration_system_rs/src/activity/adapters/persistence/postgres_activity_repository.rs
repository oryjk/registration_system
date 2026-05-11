use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration, ActivityStatusCounts,
    ActivityTeamCheckInConfig, DomainError, RegistrationListPage, RegistrationStandCounts,
    RegistrationWithInfo, UpdateActivityFields,
};
use crate::activity::ports::ActivityRepository;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::{FromRow, PgPool};

#[derive(Debug, FromRow)]
struct ActivityRow {
    pub id: String,
    pub cover: Option<String>,
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
    pub holding_date: NaiveDateTime,
    pub location: String,
    pub location_latitude: Option<f64>,
    pub location_longitude: Option<f64>,
    pub name: String,
    pub opposing: Option<String>,
    pub status: i16,
    pub description: Option<String>,
    pub home_team_id: Option<String>,
    pub away_team_id: Option<String>,
    pub color: Option<String>,
    pub opposing_color: Option<String>,
    pub players_per_team: Option<i32>,
    pub source_activity_id: Option<String>,
    pub team_registration_count: Option<i32>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[cfg(test)]
mod tests {
    use super::{ActivityRow, trim_activity_id};
    use chrono::NaiveDate;

    #[test]
    fn trims_char_padding_from_activity_ids() {
        assert_eq!(trim_activity_id("act-filter-1      "), "act-filter-1");
        assert_eq!(
            trim_activity_id("8202e940-d814-4a3f-9464-e285baf3dc79"),
            "8202e940-d814-4a3f-9464-e285baf3dc79"
        );
    }

    #[test]
    fn converts_padded_activity_row_ids_to_trimmed_domain_ids() {
        let now = NaiveDate::from_ymd_opt(2026, 4, 15)
            .expect("valid date")
            .and_hms_opt(20, 0, 0)
            .expect("valid time");

        let activity = crate::activity::domain::Activity::from(ActivityRow {
            id: "act-filter-1776256129841949000      ".to_string(),
            cover: None,
            start_time: now,
            end_time: now,
            holding_date: now,
            location: "测试球场".to_string(),
            location_latitude: None,
            location_longitude: None,
            name: "测试活动".to_string(),
            opposing: None,
            status: 0,
            description: None,
            home_team_id: None,
            away_team_id: None,
            color: None,
            opposing_color: None,
            players_per_team: None,
            source_activity_id: None,
            team_registration_count: None,
            created_at: now,
            updated_at: now,
        });

        assert_eq!(activity.id, "act-filter-1776256129841949000");
    }
}

fn trim_activity_id(value: &str) -> String {
    value.trim_end().to_string()
}

impl From<ActivityRow> for Activity {
    fn from(row: ActivityRow) -> Self {
        Self {
            id: trim_activity_id(&row.id),
            cover: row.cover,
            start_time: row.start_time,
            end_time: row.end_time,
            holding_date: row.holding_date,
            location: row.location,
            location_latitude: row.location_latitude,
            location_longitude: row.location_longitude,
            name: row.name,
            opposing: row.opposing,
            status: row.status as i8,
            description: row.description,
            home_team_id: row.home_team_id,
            away_team_id: row.away_team_id,
            color: row.color,
            opposing_color: row.opposing_color,
            players_per_team: row.players_per_team,
            source_activity_id: row.source_activity_id.map(|value| trim_activity_id(&value)),
            team_registration_count: row.team_registration_count,
            team_checkin_configs: vec![],
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct ActivityRegistrationRow {
    pub id: i64,
    pub activity_id: String,
    pub user_id: i64,
    pub stand: i16,
    pub registration_count: i32,
    pub paid: i16,
    pub operation_time: NaiveDateTime,
    pub checked_in_at: Option<NaiveDateTime>,
    pub checkin_distance_meters: Option<i32>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<ActivityRegistrationRow> for ActivityRegistration {
    fn from(row: ActivityRegistrationRow) -> Self {
        Self {
            id: row.id,
            activity_id: trim_activity_id(&row.activity_id),
            user_id: row.user_id,
            stand: row.stand as i8,
            registration_count: row.registration_count,
            paid: row.paid as i8,
            operation_time: row.operation_time,
            checked_in_at: row.checked_in_at,
            checkin_distance_meters: row.checkin_distance_meters,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct ActivityTeamCheckInConfigRow {
    pub activity_id: String,
    pub team_id: String,
    pub enabled: bool,
    pub radius_meters: i32,
    pub open_minutes_before: i32,
    pub close_minutes_after: i32,
    pub updated_by_user_id: Option<i64>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<ActivityTeamCheckInConfigRow> for ActivityTeamCheckInConfig {
    fn from(row: ActivityTeamCheckInConfigRow) -> Self {
        Self {
            activity_id: trim_activity_id(&row.activity_id),
            team_id: row.team_id,
            enabled: row.enabled,
            radius_meters: row.radius_meters,
            open_minutes_before: row.open_minutes_before,
            close_minutes_after: row.close_minutes_after,
            updated_by_user_id: row.updated_by_user_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct ActivityCheckInRecordRow {
    pub id: i64,
    pub activity_id: String,
    pub team_id: String,
    pub user_id: i64,
    pub latitude: f64,
    pub longitude: f64,
    pub distance_meters: i32,
    pub checked_in_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<ActivityCheckInRecordRow> for ActivityCheckInRecord {
    fn from(row: ActivityCheckInRecordRow) -> Self {
        Self {
            id: row.id,
            activity_id: trim_activity_id(&row.activity_id),
            team_id: row.team_id,
            user_id: row.user_id,
            latitude: row.latitude,
            longitude: row.longitude,
            distance_meters: row.distance_meters,
            checked_in_at: row.checked_in_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Clone)]
pub struct PostgresActivityRepository {
    pool: PgPool,
}

impl PostgresActivityRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

const ACTIVITY_COLS: &str = "id, cover, start_time, end_time, holding_date, location, location_latitude, location_longitude, name, opposing, status, description, home_team_id, away_team_id, color, opposing_color, players_per_team, source_activity_id, team_registration_count, created_at, updated_at";

#[async_trait]
impl ActivityRepository for PostgresActivityRepository {
    async fn create(&self, activity: &Activity) -> Result<(), DomainError> {
        sqlx::query(
            r#"INSERT INTO rs_activity (id, cover, start_time, end_time, holding_date, location, location_latitude, location_longitude, name, opposing, status,
               description, home_team_id, away_team_id, color, opposing_color, players_per_team, source_activity_id, team_registration_count, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)"#,
        )
        .bind(&activity.id).bind(&activity.cover)
        .bind(activity.start_time).bind(activity.end_time).bind(activity.holding_date)
        .bind(&activity.location).bind(activity.location_latitude).bind(activity.location_longitude)
        .bind(&activity.name).bind(&activity.opposing).bind(activity.status as i16)
        .bind(&activity.description).bind(&activity.home_team_id).bind(&activity.away_team_id)
        .bind(&activity.color).bind(&activity.opposing_color).bind(activity.players_per_team)
        .bind(&activity.source_activity_id).bind(activity.team_registration_count)
        .bind(activity.created_at).bind(activity.updated_at)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn list_page(
        &self,
        status_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<ActivityListPage, DomainError> {
        #[derive(Debug, FromRow)]
        struct CountsRow {
            total: i64,
            registering: i64,
            ongoing: i64,
            ended: i64,
            cancelled: i64,
        }

        let counts_row = sqlx::query_as::<_, CountsRow>(
            r#"SELECT
                 COUNT(*)::bigint AS total,
                 COUNT(*) FILTER (WHERE status = 0)::bigint AS registering,
                 COUNT(*) FILTER (WHERE status = 1)::bigint AS ongoing,
                 COUNT(*) FILTER (WHERE status = 2)::bigint AS ended,
                 COUNT(*) FILTER (WHERE status = 3)::bigint AS cancelled
               FROM rs_activity"#,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let status_bind: Option<i16> = status_filter.map(i16::from);

        let (total_filtered,): (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*)::bigint FROM rs_activity
               WHERE ($1::smallint IS NULL OR status = $1)"#,
        )
        .bind(status_bind)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let offset = ((page.saturating_sub(1)) as i64).saturating_mul(page_size as i64);
        let limit = page_size as i64;

        let rows = sqlx::query_as::<_, ActivityRow>(&format!(
            "SELECT {ACTIVITY_COLS} FROM rs_activity
             WHERE ($1::smallint IS NULL OR status = $1)
             ORDER BY holding_date DESC
             LIMIT $2 OFFSET $3",
        ))
        .bind(status_bind)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let items = rows.into_iter().map(Activity::from).collect();

        Ok(ActivityListPage {
            items,
            total: total_filtered,
            page,
            page_size,
            counts: ActivityStatusCounts {
                total: counts_row.total,
                registering: counts_row.registering,
                ongoing: counts_row.ongoing,
                ended: counts_row.ended,
                cancelled: counts_row.cancelled,
            },
        })
    }

    async fn find_by_id(&self, activity_id: &str) -> Result<Option<Activity>, DomainError> {
        let row = sqlx::query_as::<_, ActivityRow>(&format!(
            "SELECT {ACTIVITY_COLS} FROM rs_activity WHERE BTRIM(id) = BTRIM($1)"
        ))
        .bind(activity_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(Activity::from))
    }

    async fn find_derived_by_source_and_team(
        &self,
        source_activity_id: &str,
        team_id: &str,
    ) -> Result<Option<Activity>, DomainError> {
        let row = sqlx::query_as::<_, ActivityRow>(&format!(
            "SELECT {ACTIVITY_COLS} FROM rs_activity
             WHERE BTRIM(source_activity_id) = BTRIM($1)
               AND home_team_id = $2
             LIMIT 1"
        ))
        .bind(source_activity_id)
        .bind(team_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(Activity::from))
    }

    async fn delete_many(&self, ids: &[String]) -> Result<(), DomainError> {
        if ids.is_empty() {
            return Ok(());
        }
        let normalized_ids = ids
            .iter()
            .map(|id| trim_activity_id(id))
            .collect::<Vec<_>>();
        sqlx::query("DELETE FROM rs_activity WHERE BTRIM(id) = ANY($1)")
            .bind(normalized_ids)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn update_status(&self, activity_id: &str, status: i8) -> Result<(), DomainError> {
        sqlx::query("UPDATE rs_activity SET status = $1 WHERE BTRIM(id) = BTRIM($2)")
            .bind(status as i16)
            .bind(activity_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn update_activity(
        &self,
        activity_id: &str,
        fields: UpdateActivityFields<'_>,
    ) -> Result<(), DomainError> {
        macro_rules! update_field {
            ($col:expr, $value:expr) => {
                if let Some(v) = $value {
                    sqlx::query(&format!(
                        "UPDATE rs_activity SET {} = $1, updated_at = NOW() WHERE BTRIM(id) = BTRIM($2)",
                        $col
                    ))
                    .bind(v)
                    .bind(activity_id)
                    .execute(&self.pool)
                    .await
                    .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
                }
            };
        }
        update_field!("name", fields.name);
        update_field!("cover", fields.cover);
        update_field!("start_time", fields.start_time);
        update_field!("end_time", fields.end_time);
        update_field!("holding_date", fields.holding_date);
        update_field!("location", fields.location);
        update_field!("location_latitude", fields.location_latitude);
        update_field!("location_longitude", fields.location_longitude);
        update_field!("opposing", fields.opposing);
        update_field!("description", fields.description);
        update_field!("home_team_id", fields.home_team_id);
        update_field!("away_team_id", fields.away_team_id);
        update_field!("color", fields.color);
        update_field!("opposing_color", fields.opposing_color);
        update_field!("players_per_team", fields.players_per_team);
        update_field!("source_activity_id", fields.source_activity_id);
        update_field!("team_registration_count", fields.team_registration_count);
        Ok(())
    }

    async fn find_ongoing_activity(&self) -> Result<Option<Activity>, DomainError> {
        let row = sqlx::query_as::<_, ActivityRow>(
            &format!(
                "SELECT {ACTIVITY_COLS} FROM rs_activity WHERE (NOW() BETWEEN start_time AND end_time) OR status = 1 ORDER BY holding_date DESC LIMIT 1"
            ),
        )
        .fetch_optional(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(Activity::from))
    }

    async fn upsert_registration(
        &self,
        activity_id: &str,
        user_id: i64,
        stand: i8,
        registration_count: i32,
    ) -> Result<(), DomainError> {
        sqlx::query(
            r#"INSERT INTO rs_user_activity (activity_id, user_id, stand, registration_count, paid, operation_time, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 0, NOW(), NOW(), NOW())
               ON CONFLICT (activity_id, user_id) DO UPDATE SET
                   stand = EXCLUDED.stand,
                   registration_count = EXCLUDED.registration_count,
                   operation_time = NOW(),
                   updated_at = NOW()"#,
        )
        .bind(trim_activity_id(activity_id)).bind(user_id).bind(stand as i16).bind(registration_count)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"INSERT INTO rs_registration_log (activity_id, user_id, previous_stand, current_stand, registration_count, operation_time, created_at)
               VALUES ($1, $2, NULL, $3, $4, NOW(), NOW())"#,
        )
        .bind(trim_activity_id(activity_id)).bind(user_id).bind(stand as i16).bind(registration_count)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn delete_registration(
        &self,
        activity_id: &str,
        user_id: i64,
    ) -> Result<u64, DomainError> {
        let result = sqlx::query(
            "DELETE FROM rs_user_activity WHERE BTRIM(activity_id) = BTRIM($1) AND user_id = $2",
        )
        .bind(activity_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(result.rows_affected())
    }

    async fn backfill_team_member_registrations(
        &self,
        activity_id: &str,
    ) -> Result<u64, DomainError> {
        let result = sqlx::query(
            r#"INSERT INTO rs_user_activity (activity_id, user_id, stand, registration_count, paid, operation_time, created_at, updated_at)
               SELECT a.id, tm.user_id, 0, 0, 0, NOW(), NOW(), NOW()
               FROM rs_activity a
               INNER JOIN rs_team_members tm ON tm.team_id IN (a.home_team_id, a.away_team_id) AND tm.status = 1
               WHERE BTRIM(a.id) = BTRIM($1)
                 AND NOT EXISTS (SELECT 1 FROM rs_user_activity ua WHERE ua.activity_id = a.id AND ua.user_id = tm.user_id)"#,
        )
        .bind(activity_id)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(result.rows_affected())
    }

    async fn list_registrations(
        &self,
        activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, DomainError> {
        let rows = sqlx::query_as::<_, ActivityRegistrationRow>(
            r#"SELECT ua.id, ua.activity_id, ua.user_id, ua.stand, ua.registration_count, ua.paid,
                      ua.operation_time, ac.checked_in_at, ac.distance_meters AS checkin_distance_meters,
                      ua.created_at, ua.updated_at
               FROM rs_user_activity ua
               LEFT JOIN rs_activity_checkins ac
                 ON BTRIM(ac.activity_id) = BTRIM(ua.activity_id)
                AND ac.user_id = ua.user_id
               WHERE BTRIM(ua.activity_id) = BTRIM($1)
               ORDER BY ua.operation_time DESC"#,
        )
        .bind(activity_id)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(ActivityRegistration::from).collect())
    }

    async fn count_capacity_registrations(&self, activity_id: &str) -> Result<i64, DomainError> {
        let row: (i64,) = sqlx::query_as(
            r#"SELECT
                   (
                     SELECT COUNT(*)::bigint
                     FROM rs_user_activity ua
                     WHERE BTRIM(ua.activity_id) = BTRIM($1)
                       AND ua.stand IN (1, 3)
                   )
                   +
                   (
                     SELECT COALESCE(SUM(team_registration_count), 0)::bigint
                     FROM rs_activity a
                     WHERE BTRIM(a.source_activity_id) = BTRIM($1)
                       AND a.status <> 3
                   ) AS total"#,
        )
        .bind(activity_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.0)
    }

    async fn list_registrations_with_info_page(
        &self,
        activity_id: &str,
        activity_holding_date: NaiveDateTime,
        stand_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<RegistrationListPage, DomainError> {
        #[derive(Debug, FromRow)]
        struct CountsRow {
            total: i64,
            unknown: i64,
            attending: i64,
            leave: i64,
            absent: i64,
        }

        let counts_row = sqlx::query_as::<_, CountsRow>(
            r#"SELECT
                 COUNT(*)::bigint AS total,
                 COUNT(*) FILTER (WHERE ua.stand = 0)::bigint AS unknown,
                 COUNT(*) FILTER (WHERE ua.stand = 1)::bigint AS attending,
               COUNT(*) FILTER (WHERE ua.stand = 2)::bigint AS leave,
               COUNT(*) FILTER (WHERE ua.stand = 3)::bigint AS absent
               FROM rs_user_activity ua
               JOIN rs_user_info u ON u.id = ua.user_id
               WHERE BTRIM(ua.activity_id) = BTRIM($1)
                 AND NOT (
                   u.leave_start_time IS NOT NULL
                   AND u.leave_start_time <= $2
                   AND (u.leave_end_time IS NULL OR u.leave_end_time >= $2)
                 )"#,
        )
        .bind(activity_id)
        .bind(activity_holding_date)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let stand_bind: Option<i16> = stand_filter.map(i16::from);

        let (total_filtered,): (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*)::bigint
               FROM rs_user_activity ua
               JOIN rs_user_info u ON u.id = ua.user_id
               WHERE BTRIM(ua.activity_id) = BTRIM($1)
                 AND NOT (
                   u.leave_start_time IS NOT NULL
                   AND u.leave_start_time <= $2
                   AND (u.leave_end_time IS NULL OR u.leave_end_time >= $2)
                 )
                 AND ($3::smallint IS NULL OR ua.stand = $3)"#,
        )
        .bind(activity_id)
        .bind(activity_holding_date)
        .bind(stand_bind)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        #[derive(Debug, FromRow)]
        struct Row {
            user_id: i64,
            stand: i16,
            registration_count: i32,
            paid: i16,
            operation_time: NaiveDateTime,
            checked_in_at: Option<NaiveDateTime>,
            checkin_distance_meters: Option<i32>,
            nickname: String,
            real_name: String,
            avatar_url: String,
            phone_number: String,
        }

        let offset = ((page.saturating_sub(1)) as i64).saturating_mul(page_size as i64);
        let limit = page_size as i64;

        let rows = sqlx::query_as::<_, Row>(
            r#"SELECT ua.user_id, ua.stand, ua.registration_count, ua.paid, ua.operation_time,
                      ac.checked_in_at, ac.distance_meters AS checkin_distance_meters,
                      u.nickname, u.real_name, u.avatar_url, u.phone_number
               FROM rs_user_activity ua
               JOIN rs_user_info u ON u.id = ua.user_id
               LEFT JOIN rs_activity_checkins ac
                 ON BTRIM(ac.activity_id) = BTRIM(ua.activity_id)
                AND ac.user_id = ua.user_id
               WHERE BTRIM(ua.activity_id) = BTRIM($1)
                 AND NOT (
                   u.leave_start_time IS NOT NULL
                   AND u.leave_start_time <= $2
                   AND (u.leave_end_time IS NULL OR u.leave_end_time >= $2)
                 )
                 AND ($3::smallint IS NULL OR ua.stand = $3)
               ORDER BY
                 CASE ua.stand
                   WHEN 1 THEN 0
                   WHEN 2 THEN 1
                   WHEN 3 THEN 2
                   ELSE 3
                 END,
                 ua.operation_time DESC
               LIMIT $4 OFFSET $5"#,
        )
        .bind(activity_id)
        .bind(activity_holding_date)
        .bind(stand_bind)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let items = rows
            .into_iter()
            .map(|r| RegistrationWithInfo {
                user_id: r.user_id,
                stand: r.stand as i8,
                registration_count: r.registration_count,
                paid: r.paid as i8,
                operation_time: r.operation_time,
                checked_in_at: r.checked_in_at,
                checkin_distance_meters: r.checkin_distance_meters,
                nickname: r.nickname,
                real_name: r.real_name,
                avatar_url: r.avatar_url,
                phone_number: r.phone_number,
            })
            .collect();

        Ok(RegistrationListPage {
            items,
            total: total_filtered,
            page,
            page_size,
            counts: RegistrationStandCounts {
                total: counts_row.total,
                unknown: counts_row.unknown,
                attending: counts_row.attending,
                leave: counts_row.leave,
                absent: counts_row.absent,
            },
        })
    }

    async fn list_team_checkin_configs(
        &self,
        activity_id: &str,
    ) -> Result<Vec<ActivityTeamCheckInConfig>, DomainError> {
        let rows = sqlx::query_as::<_, ActivityTeamCheckInConfigRow>(
            r#"SELECT activity_id, team_id, enabled, radius_meters, open_minutes_before,
                      close_minutes_after, updated_by_user_id, created_at, updated_at
               FROM rs_activity_team_checkin_configs
               WHERE BTRIM(activity_id) = BTRIM($1)
               ORDER BY team_id ASC"#,
        )
        .bind(activity_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(ActivityTeamCheckInConfig::from)
            .collect())
    }

    async fn upsert_team_checkin_config(
        &self,
        config: &ActivityTeamCheckInConfig,
    ) -> Result<(), DomainError> {
        sqlx::query(
            r#"INSERT INTO rs_activity_team_checkin_configs (
                   activity_id, team_id, enabled, radius_meters, open_minutes_before,
                   close_minutes_after, updated_by_user_id, created_at, updated_at
               )
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (activity_id, team_id) DO UPDATE SET
                   enabled = EXCLUDED.enabled,
                   radius_meters = EXCLUDED.radius_meters,
                   open_minutes_before = EXCLUDED.open_minutes_before,
                   close_minutes_after = EXCLUDED.close_minutes_after,
                   updated_by_user_id = EXCLUDED.updated_by_user_id,
                   updated_at = EXCLUDED.updated_at"#,
        )
        .bind(trim_activity_id(&config.activity_id))
        .bind(&config.team_id)
        .bind(config.enabled)
        .bind(config.radius_meters)
        .bind(config.open_minutes_before)
        .bind(config.close_minutes_after)
        .bind(config.updated_by_user_id)
        .bind(config.created_at)
        .bind(config.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(())
    }

    async fn find_team_checkin_config(
        &self,
        activity_id: &str,
        team_id: &str,
    ) -> Result<Option<ActivityTeamCheckInConfig>, DomainError> {
        let row = sqlx::query_as::<_, ActivityTeamCheckInConfigRow>(
            r#"SELECT activity_id, team_id, enabled, radius_meters, open_minutes_before,
                      close_minutes_after, updated_by_user_id, created_at, updated_at
               FROM rs_activity_team_checkin_configs
               WHERE BTRIM(activity_id) = BTRIM($1) AND team_id = $2
               LIMIT 1"#,
        )
        .bind(activity_id)
        .bind(team_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(ActivityTeamCheckInConfig::from))
    }

    async fn record_checkin(
        &self,
        record: &ActivityCheckInRecord,
    ) -> Result<ActivityCheckInRecord, DomainError> {
        let row = sqlx::query_as::<_, ActivityCheckInRecordRow>(
            r#"INSERT INTO rs_activity_checkins (
                   activity_id, team_id, user_id, latitude, longitude,
                   distance_meters, checked_in_at, created_at, updated_at
               )
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING id, activity_id, team_id, user_id, latitude, longitude,
                         distance_meters, checked_in_at, created_at, updated_at"#,
        )
        .bind(trim_activity_id(&record.activity_id))
        .bind(&record.team_id)
        .bind(record.user_id)
        .bind(record.latitude)
        .bind(record.longitude)
        .bind(record.distance_meters)
        .bind(record.checked_in_at)
        .bind(record.created_at)
        .bind(record.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(ActivityCheckInRecord::from(row))
    }

    async fn find_checkin_record(
        &self,
        activity_id: &str,
        team_id: &str,
        user_id: i64,
    ) -> Result<Option<ActivityCheckInRecord>, DomainError> {
        let row = sqlx::query_as::<_, ActivityCheckInRecordRow>(
            r#"SELECT id, activity_id, team_id, user_id, latitude, longitude,
                      distance_meters, checked_in_at, created_at, updated_at
               FROM rs_activity_checkins
               WHERE BTRIM(activity_id) = BTRIM($1) AND team_id = $2 AND user_id = $3
               LIMIT 1"#,
        )
        .bind(activity_id)
        .bind(team_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(ActivityCheckInRecord::from))
    }
}
