use crate::user::domain::{
    DomainError, PlayerAdminListQuery, PlayerListResult, PlayerTeamSummary, PlayerWithTeams,
    UpdateUserFields, User, UserActivityRecord, UserAttendanceRanking, UserAttendanceRecord,
};
use crate::user::ports::{UserCommandRepository, UserQueryRepository};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::{FromRow, PgPool};

#[derive(Debug, FromRow)]
struct PlayerAdminRow {
    pub id: i64,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
    pub is_venue: bool,
    pub status: i16,
    pub create_time: NaiveDateTime,
    pub latest_login_date: NaiveDateTime,
    pub leave_start_time: Option<NaiveDateTime>,
    pub leave_end_time: Option<NaiveDateTime>,
}

#[derive(Debug, FromRow)]
struct PlayerTeamRow {
    pub user_id: i64,
    pub team_id: String,
    pub team_name: String,
    pub role: String,
    pub jersey_number: Option<String>,
}

#[derive(Debug, FromRow)]
struct UserRow {
    pub id: i64,
    pub open_id: String,
    pub union_id: Option<String>,
    pub username: String,
    pub nickname: String,
    pub real_name: String,
    pub avatar_url: String,
    pub phone_number: String,
    pub is_manager: i16,
    pub is_venue: bool,
    pub status: i16,
    pub create_time: NaiveDateTime,
    pub latest_login_date: NaiveDateTime,
    pub leave_start_time: Option<NaiveDateTime>,
    pub leave_end_time: Option<NaiveDateTime>,
}

impl From<UserRow> for User {
    fn from(row: UserRow) -> Self {
        Self {
            id: row.id,
            open_id: row.open_id,
            union_id: row.union_id,
            username: row.username,
            nickname: row.nickname,
            real_name: row.real_name,
            avatar_url: row.avatar_url,
            phone_number: row.phone_number,
            is_manager: row.is_manager as i8,
            is_venue: if row.is_venue { 1 } else { 0 },
            status: row.status as i8,
            create_time: row.create_time,
            latest_login_date: row.latest_login_date,
            leave_start_time: row.leave_start_time,
            leave_end_time: row.leave_end_time,
        }
    }
}

#[derive(Debug, FromRow)]
struct UserActivityRecordRow {
    pub activity_id: String,
    pub user_id: i64,
    pub stand: i16,
    pub registration_count: i32,
    pub operation_time: NaiveDateTime,
}

impl From<UserActivityRecordRow> for UserActivityRecord {
    fn from(row: UserActivityRecordRow) -> Self {
        Self {
            activity_id: row.activity_id,
            user_id: row.user_id,
            stand: row.stand as i8,
            registration_count: row.registration_count,
            operation_time: row.operation_time,
        }
    }
}

#[derive(Debug, FromRow)]
struct UserAttendanceRecordRow {
    pub activity_id: String,
    pub activity_name: String,
    pub holding_date: NaiveDateTime,
    pub location: String,
    pub stand: i16,
    pub registration_count: i32,
    pub operation_time: NaiveDateTime,
}

impl From<UserAttendanceRecordRow> for UserAttendanceRecord {
    fn from(row: UserAttendanceRecordRow) -> Self {
        Self {
            activity_id: row.activity_id,
            activity_name: row.activity_name,
            holding_date: row.holding_date,
            location: row.location,
            stand: row.stand as i8,
            registration_count: row.registration_count,
            operation_time: row.operation_time,
        }
    }
}

#[derive(Debug, FromRow)]
struct UserAttendanceRankingRow {
    pub user_id: i64,
    pub user_name: String,
    pub avatar_url: Option<String>,
    pub attended_count: i64,
}

impl From<UserAttendanceRankingRow> for UserAttendanceRanking {
    fn from(row: UserAttendanceRankingRow) -> Self {
        Self {
            user_id: row.user_id,
            user_name: row.user_name,
            avatar_url: row.avatar_url,
            attended_count: row.attended_count,
        }
    }
}

#[derive(Clone)]
pub struct PostgresUserRepository {
    pool: PgPool,
}

impl PostgresUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserQueryRepository for PostgresUserRepository {
    async fn find_by_open_id(&self, open_id: &str) -> Result<Option<User>, DomainError> {
        let row = sqlx::query_as::<_, UserRow>(
            r#"
            SELECT id, open_id, union_id, username, nickname, real_name, avatar_url,
                   phone_number, is_manager, is_venue, status, create_time, latest_login_date,
                   leave_start_time, leave_end_time
            FROM rs_user_info
            WHERE open_id = $1
            "#,
        )
        .bind(open_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(User::from))
    }

    async fn find_by_id(&self, user_id: i64) -> Result<Option<User>, DomainError> {
        let row = sqlx::query_as::<_, UserRow>(
            r#"
            SELECT id, open_id, union_id, username, nickname, real_name, avatar_url,
                   phone_number, is_manager, is_venue, status, create_time, latest_login_date,
                   leave_start_time, leave_end_time
            FROM rs_user_info
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(User::from))
    }

    async fn list_active(&self) -> Result<Vec<User>, DomainError> {
        let rows = sqlx::query_as::<_, UserRow>(
            r#"
            SELECT id, open_id, union_id, username, nickname, real_name, avatar_url,
                   phone_number, is_manager, is_venue, status, create_time, latest_login_date,
                   leave_start_time, leave_end_time
            FROM rs_user_info
            WHERE status = 1
            ORDER BY create_time ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(User::from).collect())
    }

    async fn search(&self, keyword: &str, limit: i64) -> Result<Vec<User>, DomainError> {
        let pattern = format!("%{keyword}%");
        let rows = sqlx::query_as::<_, UserRow>(
            r#"
            SELECT id, open_id, union_id, username, nickname, real_name, avatar_url,
                   phone_number, is_manager, is_venue, status, create_time, latest_login_date,
                   leave_start_time, leave_end_time
            FROM rs_user_info
            WHERE status = 1 AND (
                nickname ILIKE $1 OR real_name ILIKE $2 OR username ILIKE $3
            )
            ORDER BY latest_login_date DESC, create_time DESC
            LIMIT $4
            "#,
        )
        .bind(&pattern)
        .bind(&pattern)
        .bind(&pattern)
        .bind(limit.clamp(1, 100))
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(User::from).collect())
    }

    async fn find_activities(&self, user_id: i64) -> Result<Vec<UserActivityRecord>, DomainError> {
        let rows = sqlx::query_as::<_, UserActivityRecordRow>(
            r#"
            SELECT activity_id, user_id, stand, registration_count, operation_time
            FROM rs_user_activity
            WHERE user_id = $1
            ORDER BY operation_time DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(UserActivityRecord::from).collect())
    }

    async fn find_attendance_records(
        &self,
        user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRecord>, DomainError> {
        let rows = sqlx::query_as::<_, UserAttendanceRecordRow>(
            r#"
            SELECT a.id AS activity_id, a.name AS activity_name, a.holding_date,
                   a.location, ua.stand, ua.registration_count, ua.operation_time
            FROM rs_user_activity ua
            INNER JOIN rs_activity a ON ua.activity_id = a.id
            WHERE ua.user_id = $1
              AND ($2::date IS NULL OR DATE(a.holding_date) >= $2::date)
              AND ($3::date IS NULL OR DATE(a.holding_date) <= $3::date)
            ORDER BY a.holding_date ASC
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(UserAttendanceRecord::from).collect())
    }

    async fn find_attendance_ranking(
        &self,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRanking>, DomainError> {
        let rows = sqlx::query_as::<_, UserAttendanceRankingRow>(
            r#"
            SELECT u.id AS user_id,
                   COALESCE(NULLIF(u.real_name, ''), NULLIF(u.nickname, ''), u.username) AS user_name,
                   NULLIF(u.avatar_url, '') AS avatar_url,
                   COUNT(*) AS attended_count
            FROM rs_user_activity ua
            INNER JOIN rs_activity a ON ua.activity_id = a.id
            INNER JOIN rs_user_info u ON ua.user_id = u.id
            WHERE ua.stand = 1
              AND ($1::date IS NULL OR DATE(a.holding_date) >= $1::date)
              AND ($2::date IS NULL OR DATE(a.holding_date) <= $2::date)
            GROUP BY u.id, u.real_name, u.nickname, u.username, u.avatar_url
            ORDER BY attended_count DESC, u.id ASC
            "#,
        )
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(UserAttendanceRanking::from).collect())
    }

    async fn find_attendance_ranking_for_user(
        &self,
        user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Option<UserAttendanceRanking>, DomainError> {
        let row = sqlx::query_as::<_, UserAttendanceRankingRow>(
            r#"
            SELECT u.id AS user_id,
                   COALESCE(NULLIF(u.real_name, ''), NULLIF(u.nickname, ''), u.username) AS user_name,
                   NULLIF(u.avatar_url, '') AS avatar_url,
                   COUNT(*) AS attended_count
            FROM rs_user_activity ua
            INNER JOIN rs_activity a ON ua.activity_id = a.id
            INNER JOIN rs_user_info u ON ua.user_id = u.id
            WHERE ua.stand = 1 AND u.id = $1
              AND ($2::date IS NULL OR DATE(a.holding_date) >= $2::date)
              AND ($3::date IS NULL OR DATE(a.holding_date) <= $3::date)
            GROUP BY u.id, u.real_name, u.nickname, u.username, u.avatar_url
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(UserAttendanceRanking::from))
    }

    async fn list_players_admin(
        &self,
        query: PlayerAdminListQuery<'_>,
    ) -> Result<PlayerListResult, DomainError> {
        self.do_list_players_admin(query).await
    }

    async fn find_player_teams(
        &self,
        user_ids: &[i64],
    ) -> Result<Vec<(i64, PlayerTeamSummary)>, DomainError> {
        self.do_find_player_teams(user_ids).await
    }
}

#[async_trait]
impl UserCommandRepository for PostgresUserRepository {
    async fn create(&self, user: &User) -> Result<User, DomainError> {
        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO rs_user_info (
                open_id, union_id, username, nickname, real_name, avatar_url,
                phone_number, is_manager, is_venue, status, create_time, latest_login_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
            "#,
        )
        .bind(&user.open_id)
        .bind(&user.union_id)
        .bind(&user.username)
        .bind(&user.nickname)
        .bind(&user.real_name)
        .bind(&user.avatar_url)
        .bind(&user.phone_number)
        .bind(user.is_manager as i16)
        .bind(user.is_venue == 1)
        .bind(user.status as i16)
        .bind(user.create_time)
        .bind(user.latest_login_date)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e
                && db.code().as_deref() == Some("23505")
            {
                return DomainError::UserAlreadyExists;
            }
            DomainError::Infrastructure(e.to_string())
        })?;

        UserQueryRepository::find_by_id(self, id)
            .await?
            .ok_or_else(|| DomainError::Infrastructure("创建用户后无法读取记录".to_string()))
    }

    async fn touch_login(&self, user_id: i64) -> Result<(), DomainError> {
        sqlx::query("UPDATE rs_user_info SET latest_login_date = NOW() WHERE id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn update_profile(
        &self,
        user_id: i64,
        nickname: Option<&str>,
        real_name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<(), DomainError> {
        if let Some(value) = nickname {
            sqlx::query("UPDATE rs_user_info SET nickname = $1 WHERE id = $2")
                .bind(value)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = real_name {
            sqlx::query("UPDATE rs_user_info SET real_name = $1 WHERE id = $2")
                .bind(value)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = avatar_url {
            sqlx::query("UPDATE rs_user_info SET avatar_url = $1 WHERE id = $2")
                .bind(value)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        Ok(())
    }

    async fn update_fields(
        &self,
        user_id: i64,
        fields: UpdateUserFields<'_>,
    ) -> Result<(), DomainError> {
        UserCommandRepository::update_profile(
            self,
            user_id,
            fields.nickname,
            fields.real_name,
            fields.avatar_url,
        )
        .await?;

        if let Some(value) = fields.phone_number {
            sqlx::query("UPDATE rs_user_info SET phone_number = $1 WHERE id = $2")
                .bind(value)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.is_manager {
            sqlx::query("UPDATE rs_user_info SET is_manager = $1 WHERE id = $2")
                .bind(if value { 1_i16 } else { 0_i16 })
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.is_venue {
            sqlx::query("UPDATE rs_user_info SET is_venue = $1 WHERE id = $2")
                .bind(value)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.status {
            sqlx::query("UPDATE rs_user_info SET status = $1 WHERE id = $2")
                .bind(value as i16)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.leave_start_time {
            sqlx::query("UPDATE rs_user_info SET leave_start_time = $1 WHERE id = $2")
                .bind(value)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.leave_end_time {
            sqlx::query("UPDATE rs_user_info SET leave_end_time = $1 WHERE id = $2")
                .bind(value)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        Ok(())
    }

    async fn delete(&self, user_id: i64) -> Result<(), DomainError> {
        sqlx::query("DELETE FROM rs_user_info WHERE id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

impl PostgresUserRepository {
    async fn do_list_players_admin(
        &self,
        query: PlayerAdminListQuery<'_>,
    ) -> Result<PlayerListResult, DomainError> {
        let offset = (query.page - 1).max(0) * query.page_size;
        let kw = query.keyword.map(|k| format!("%{}%", k));
        let status_val = query.status.map(|s| s as i16);

        let order_clause = match query.sort_by {
            Some("latest_login_date") => {
                let order = if query.sort_order == Some("asc") {
                    "ASC"
                } else {
                    "DESC"
                };
                format!("ORDER BY u.latest_login_date {}, u.id DESC", order)
            }
            Some("status") => {
                let order = if query.sort_order == Some("asc") {
                    "ASC"
                } else {
                    "DESC"
                };
                format!("ORDER BY u.status {}, u.id DESC", order)
            }
            Some("create_time") => {
                let order = if query.sort_order == Some("asc") {
                    "ASC"
                } else {
                    "DESC"
                };
                format!("ORDER BY u.create_time {}, u.id DESC", order)
            }
            _ => "ORDER BY u.id DESC".to_string(),
        };

        // 总数
        let total: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(DISTINCT u.id)
            FROM rs_user_info u
            WHERE ($1::text IS NULL OR u.nickname ILIKE $1 OR u.real_name ILIKE $1 OR u.phone_number ILIKE $1)
              AND ($2::smallint IS NULL OR u.status = $2)
              AND (
                $3::boolean IS NULL OR
                ($3 = true  AND EXISTS (SELECT 1 FROM rs_team_members tm WHERE tm.user_id = u.id AND tm.status = 1)) OR
                ($3 = false AND NOT EXISTS (SELECT 1 FROM rs_team_members tm WHERE tm.user_id = u.id AND tm.status = 1))
              )
              AND (
                $4::bigint IS NULL OR
                EXISTS (
                  SELECT 1
                  FROM rs_team_members tm
                  JOIN rs_admin_team_assignment ata ON ata.team_id = tm.team_id
                  JOIN rs_teams t ON t.id = tm.team_id::text
                  WHERE tm.user_id = u.id
                    AND tm.status = 1
                    AND ata.admin_id = $4
                    AND t.status = 1
                )
              )
            "#,
        )
        .bind(&kw)
        .bind(status_val)
        .bind(query.has_team)
        .bind(query.admin_scope)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        // 分页球员列表
        let rows = sqlx::query_as::<_, PlayerAdminRow>(
            &format!(
                r#"
            SELECT DISTINCT u.id, u.nickname, u.real_name, u.avatar_url, u.phone_number,
                   u.is_venue, u.status, u.create_time, u.latest_login_date,
                   u.leave_start_time, u.leave_end_time
            FROM rs_user_info u
            WHERE ($1::text IS NULL OR u.nickname ILIKE $1 OR u.real_name ILIKE $1 OR u.phone_number ILIKE $1)
              AND ($2::smallint IS NULL OR u.status = $2)
              AND (
                $3::boolean IS NULL OR
                ($3 = true  AND EXISTS (SELECT 1 FROM rs_team_members tm WHERE tm.user_id = u.id AND tm.status = 1)) OR
                ($3 = false AND NOT EXISTS (SELECT 1 FROM rs_team_members tm WHERE tm.user_id = u.id AND tm.status = 1))
              )
              AND (
                $4::bigint IS NULL OR
                EXISTS (
                  SELECT 1
                  FROM rs_team_members tm
                  JOIN rs_admin_team_assignment ata ON ata.team_id = tm.team_id
                  JOIN rs_teams t ON t.id = tm.team_id::text
                  WHERE tm.user_id = u.id
                    AND tm.status = 1
                    AND ata.admin_id = $4
                    AND t.status = 1
                )
              )
            {}
            LIMIT $5 OFFSET $6
            "#,
                order_clause
            ),
        )
        .bind(&kw)
        .bind(status_val)
        .bind(query.has_team)
        .bind(query.admin_scope)
        .bind(query.page_size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        if rows.is_empty() {
            return Ok(PlayerListResult {
                items: vec![],
                total,
            });
        }

        // 批量查询这批球员的球队归属
        let user_ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
        let team_rows = self.do_find_player_teams(&user_ids).await?;

        // 按 user_id 聚合球队信息
        let mut teams_map: std::collections::HashMap<i64, Vec<PlayerTeamSummary>> =
            std::collections::HashMap::new();
        for (uid, summary) in team_rows {
            teams_map.entry(uid).or_default().push(summary);
        }

        let items = rows
            .into_iter()
            .map(|r| PlayerWithTeams {
                id: r.id,
                nickname: r.nickname,
                real_name: r.real_name,
                avatar_url: r.avatar_url,
                phone_number: r.phone_number,
                is_venue: if r.is_venue { 1 } else { 0 },
                status: r.status as i8,
                create_time: r.create_time,
                latest_login_date: r.latest_login_date,
                leave_start_time: r.leave_start_time,
                leave_end_time: r.leave_end_time,
                teams: teams_map.remove(&r.id).unwrap_or_default(),
            })
            .collect();

        Ok(PlayerListResult { items, total })
    }

    async fn do_find_player_teams(
        &self,
        user_ids: &[i64],
    ) -> Result<Vec<(i64, PlayerTeamSummary)>, DomainError> {
        if user_ids.is_empty() {
            return Ok(vec![]);
        }
        let rows = sqlx::query_as::<_, PlayerTeamRow>(
            r#"
            SELECT tm.user_id, CAST(t.id AS TEXT) AS team_id, t.name AS team_name,
                   tm.role, tm.jersey_number
            FROM rs_team_members tm
            JOIN rs_teams t ON t.id = tm.team_id::text
            WHERE tm.user_id = ANY($1)
              AND tm.status = 1
              AND t.status = 1
            ORDER BY tm.joined_at ASC
            "#,
        )
        .bind(user_ids)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| {
                (
                    r.user_id,
                    PlayerTeamSummary {
                        team_id: r.team_id,
                        team_name: r.team_name,
                        role: r.role,
                        jersey_number: r.jersey_number,
                    },
                )
            })
            .collect())
    }
}
