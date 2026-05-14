use super::models::{ActivityCheckInRecordRow, trim_activity_id};
use super::postgres_activity_repository::PostgresActivityRepository;
use crate::activity::domain::{
    Activity, ActivityCheckInRecord, ActivityTeamCheckInConfig, DomainError, UpdateActivityFields,
};

impl PostgresActivityRepository {
    pub(super) async fn create_command(&self, activity: &Activity) -> Result<(), DomainError> {
        sqlx::query(
            r#"INSERT INTO rs_activity (id, cover, start_time, end_time, holding_date, location, location_latitude, location_longitude, name, opposing, status,
               description, home_team_id, away_team_id, color, opposing_color, players_per_team, match_kind, source_activity_id, team_registration_count, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)"#,
        )
        .bind(&activity.id).bind(&activity.cover)
        .bind(activity.start_time).bind(activity.end_time).bind(activity.holding_date)
        .bind(&activity.location).bind(activity.location_latitude).bind(activity.location_longitude)
        .bind(&activity.name).bind(&activity.opposing).bind(activity.status as i16)
        .bind(&activity.description).bind(activity.home_team_id).bind(activity.away_team_id)
        .bind(&activity.color).bind(&activity.opposing_color).bind(activity.players_per_team)
        .bind(activity.match_kind.as_deref().unwrap_or("external"))
        .bind(&activity.source_activity_id).bind(activity.team_registration_count)
        .bind(activity.created_at).bind(activity.updated_at)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    pub(super) async fn delete_many_command(&self, ids: &[String]) -> Result<(), DomainError> {
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

    pub(super) async fn update_status_command(
        &self,
        activity_id: &str,
        status: i8,
    ) -> Result<(), DomainError> {
        sqlx::query("UPDATE rs_activity SET status = $1 WHERE BTRIM(id) = BTRIM($2)")
            .bind(status as i16)
            .bind(activity_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    pub(super) async fn update_activity_command(
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
        update_field!("match_kind", fields.match_kind);
        update_field!("source_activity_id", fields.source_activity_id);
        update_field!("team_registration_count", fields.team_registration_count);
        Ok(())
    }

    pub(super) async fn upsert_registration_command(
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

    pub(super) async fn delete_registration_command(
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

    pub(super) async fn backfill_team_member_registrations_command(
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

    pub(super) async fn upsert_team_checkin_config_command(
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
        .bind(config.team_id)
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

    pub(super) async fn record_checkin_command(
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
        .bind(record.team_id)
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
}
