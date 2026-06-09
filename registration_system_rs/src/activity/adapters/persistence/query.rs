use super::models::{
    ACTIVITY_COLS, ActivityCheckInRecordRow, ActivityRegistrationRow, ActivityRow,
    ActivityTeamCheckInConfigRow,
};
use super::postgres_activity_repository::PostgresActivityRepository;
use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
    ActivityRegistrationPreview, ActivityRegistrationPreviewMember, ActivityStatusCounts,
    ActivityTeamCheckInConfig, DomainError, RegistrationListPage, RegistrationStandCounts,
    RegistrationWithInfo,
};
use chrono::NaiveDateTime;
use std::collections::HashMap;
use sqlx::FromRow;
use tokio::try_join;

impl PostgresActivityRepository {
    pub(super) async fn list_page_query(
        &self,
        status_filter: Option<i8>,
        registration_scope: Option<&str>,
        team_id: Option<i64>,
        holding_after: Option<NaiveDateTime>,
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

        let scope_bind = registration_scope;
        let status_bind: Option<i16> = status_filter.map(i16::from);
        let offset = ((page.saturating_sub(1)) as i64).saturating_mul(page_size as i64);
        let limit = page_size as i64;

        let counts_future = sqlx::query_as::<_, CountsRow>(
            r#"SELECT
                 COUNT(*)::bigint AS total,
                 COUNT(*) FILTER (WHERE status = 0)::bigint AS registering,
                 COUNT(*) FILTER (WHERE status = 1)::bigint AS ongoing,
                 COUNT(*) FILTER (WHERE status = 2)::bigint AS ended,
                 COUNT(*) FILTER (WHERE status = 3)::bigint AS cancelled
               FROM rs_activity
               WHERE (
                    ($1::text IS NULL)
                    OR ($1 = 'team' AND (home_team_id IS NOT NULL OR away_team_id IS NOT NULL))
                    OR ($1 = 'direct' AND home_team_id IS NULL AND away_team_id IS NULL)
                 )
                 AND ($2::bigint IS NULL OR home_team_id = $2 OR away_team_id = $2)
                 AND ($3::timestamp IS NULL OR holding_date > $3)"#,
        )
        .bind(scope_bind)
        .bind(team_id)
        .bind(holding_after)
        .fetch_one(&self.pool);

        let total_filtered_future = sqlx::query_as(
            r#"SELECT COUNT(*)::bigint FROM rs_activity
               WHERE ($1::smallint IS NULL OR status = $1)
                 AND (
                   ($2::text IS NULL)
                   OR ($2 = 'team' AND (home_team_id IS NOT NULL OR away_team_id IS NOT NULL))
                   OR ($2 = 'direct' AND home_team_id IS NULL AND away_team_id IS NULL)
                 )
                 AND ($3::bigint IS NULL OR home_team_id = $3 OR away_team_id = $3)
                 AND ($4::timestamp IS NULL OR holding_date > $4)"#,
        )
        .bind(status_bind)
        .bind(scope_bind)
        .bind(team_id)
        .bind(holding_after)
        .fetch_one(&self.pool);

        let rows_sql = format!(
            "SELECT {ACTIVITY_COLS} FROM rs_activity
             WHERE ($1::smallint IS NULL OR status = $1)
               AND (
                 ($2::text IS NULL)
                 OR ($2 = 'team' AND (home_team_id IS NOT NULL OR away_team_id IS NOT NULL))
                 OR ($2 = 'direct' AND home_team_id IS NULL AND away_team_id IS NULL)
               )
               AND ($3::bigint IS NULL OR home_team_id = $3 OR away_team_id = $3)
               AND ($4::timestamp IS NULL OR holding_date > $4)
             ORDER BY holding_date DESC, id DESC
             LIMIT $5 OFFSET $6",
        );
        let rows_future = sqlx::query_as::<_, ActivityRow>(&rows_sql)
        .bind(status_bind)
        .bind(scope_bind)
        .bind(team_id)
        .bind(holding_after)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool);

        let (counts_row, (total_filtered,), rows) =
            try_join!(counts_future, total_filtered_future, rows_future)
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let mut items: Vec<Activity> = rows.into_iter().map(Activity::from).collect();
        let activity_ids = items
            .iter()
            .map(|activity| activity.id.clone())
            .collect::<Vec<_>>();
        let mut previews = self.load_registration_previews(&activity_ids).await?;
        for activity in &mut items {
            activity.registration_preview = previews.remove(&activity.id).unwrap_or_default();
        }

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

    async fn load_registration_previews(
        &self,
        activity_ids: &[String],
    ) -> Result<HashMap<String, ActivityRegistrationPreview>, DomainError> {
        if activity_ids.is_empty() {
            return Ok(HashMap::new());
        }

        #[derive(Debug, FromRow)]
        struct CountRow {
            activity_id: String,
            total: i64,
            unknown: i64,
            attending: i64,
            leave: i64,
            absent: i64,
        }

        #[derive(Debug, FromRow)]
        struct MemberRow {
            activity_id: String,
            user_id: i64,
            stand: i16,
            registration_count: i32,
            operation_time: NaiveDateTime,
            nickname: String,
            real_name: String,
            avatar_url: String,
        }

        let counts_future = sqlx::query_as::<_, CountRow>(
            r#"
            SELECT BTRIM(ua.activity_id) AS activity_id,
                   COUNT(*)::bigint AS total,
                   COUNT(*) FILTER (WHERE ua.stand = 0)::bigint AS unknown,
                   COUNT(*) FILTER (WHERE ua.stand = 1)::bigint AS attending,
                   COUNT(*) FILTER (WHERE ua.stand = 2)::bigint AS leave,
                   COUNT(*) FILTER (WHERE ua.stand = 3)::bigint AS absent
            FROM rs_user_activity ua
            JOIN rs_user_info u ON u.id = ua.user_id
            WHERE BTRIM(ua.activity_id) = ANY($1)
              AND u.status = 1
            GROUP BY BTRIM(ua.activity_id)
            "#,
        )
        .bind(activity_ids)
        .fetch_all(&self.pool);

        let members_future = sqlx::query_as::<_, MemberRow>(
            r#"
            SELECT activity_id, user_id, stand, registration_count, operation_time,
                   nickname, real_name, avatar_url
            FROM (
                SELECT BTRIM(ua.activity_id) AS activity_id,
                       ua.user_id,
                       ua.stand,
                       ua.registration_count,
                       ua.operation_time,
                       u.nickname,
                       u.real_name,
                       u.avatar_url,
                       ROW_NUMBER() OVER (
                           PARTITION BY BTRIM(ua.activity_id), ua.stand
                           ORDER BY ua.operation_time ASC, ua.user_id ASC
                       ) AS row_num
                FROM rs_user_activity ua
                JOIN rs_user_info u ON u.id = ua.user_id
                WHERE BTRIM(ua.activity_id) = ANY($1)
                  AND u.status = 1
            ) ranked
            WHERE row_num <= 8
            ORDER BY activity_id ASC,
                     CASE stand
                       WHEN 1 THEN 0
                       WHEN 3 THEN 1
                       WHEN 2 THEN 2
                       ELSE 3
                     END,
                     operation_time ASC,
                     user_id ASC
            "#,
        )
        .bind(activity_ids)
        .fetch_all(&self.pool);

        let (count_rows, member_rows) = try_join!(counts_future, members_future)
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let mut previews = HashMap::new();
        for row in count_rows {
            previews.insert(
                row.activity_id,
                ActivityRegistrationPreview {
                    counts: RegistrationStandCounts {
                        total: row.total,
                        unknown: row.unknown,
                        attending: row.attending,
                        leave: row.leave,
                        absent: row.absent,
                    },
                    members: Vec::new(),
                },
            );
        }

        for row in member_rows {
            previews
                .entry(row.activity_id)
                .or_insert_with(ActivityRegistrationPreview::default)
                .members
                .push(ActivityRegistrationPreviewMember {
                    user_id: row.user_id,
                    stand: row.stand as i8,
                    registration_count: row.registration_count,
                    operation_time: row.operation_time,
                    nickname: row.nickname,
                    real_name: row.real_name,
                    avatar_url: row.avatar_url,
                });
        }

        Ok(previews)
    }

    pub(super) async fn find_by_id_query(
        &self,
        activity_id: &str,
    ) -> Result<Option<Activity>, DomainError> {
        let row = sqlx::query_as::<_, ActivityRow>(&format!(
            "SELECT {ACTIVITY_COLS} FROM rs_activity WHERE BTRIM(id) = BTRIM($1)"
        ))
        .bind(activity_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(Activity::from))
    }

    pub(super) async fn find_derived_by_source_and_team_query(
        &self,
        source_activity_id: &str,
        team_id: i64,
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

    pub(super) async fn find_ongoing_activity_query(
        &self,
    ) -> Result<Option<Activity>, DomainError> {
        let row = sqlx::query_as::<_, ActivityRow>(
            &format!(
                "SELECT {ACTIVITY_COLS} FROM rs_activity WHERE (NOW() BETWEEN start_time AND end_time) OR status = 1 ORDER BY holding_date DESC LIMIT 1"
            ),
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(Activity::from))
    }

    pub(super) async fn list_registrations_query(
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
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(ActivityRegistration::from).collect())
    }

    pub(super) async fn count_capacity_registrations_query(
        &self,
        activity_id: &str,
    ) -> Result<i64, DomainError> {
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

    pub(super) async fn list_registrations_with_info_page_query(
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

    pub(super) async fn list_team_checkin_configs_query(
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

    pub(super) async fn find_team_checkin_config_query(
        &self,
        activity_id: &str,
        team_id: i64,
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

    pub(super) async fn find_checkin_record_query(
        &self,
        activity_id: &str,
        team_id: i64,
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
