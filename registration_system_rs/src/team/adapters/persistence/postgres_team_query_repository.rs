use super::models::{
    ActivityTeamReviewRow, TeamAdminInfoRow, TeamAttendanceRankingRow, TeamCreditTransactionRow,
    TeamMemberAttendanceRecordRow, TeamMemberRow, TeamMemberWithInfoRow, TeamRow,
};
use crate::team::domain::{
    ActivityTeamReview, DomainError, Team, TeamAdminInfo, TeamAttendanceRankingItem,
    TeamCreditTransaction, TeamMember, TeamMemberAttendanceRecord, TeamMemberWithInfo,
};
use crate::team::ports::TeamQueryRepository;
use async_trait::async_trait;
use sqlx::PgPool;

#[derive(Clone)]
pub struct PostgresTeamQueryRepository {
    pool: PgPool,
}

impl PostgresTeamQueryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TeamQueryRepository for PostgresTeamQueryRepository {
    async fn find_by_id(&self, team_id: i64) -> Result<Option<Team>, DomainError> {
        let row = sqlx::query_as::<_, TeamRow>(
            r#"
            SELECT id, name, description, logo_url, captain_id, join_password_hash, status, credit_score, vip_until, created_at, updated_at
            FROM rs_teams WHERE id = $1
            "#,
        )
        .bind(team_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(Team::from))
    }

    async fn find_by_name(&self, name: &str) -> Result<Option<Team>, DomainError> {
        let row = sqlx::query_as::<_, TeamRow>(
            r#"
            SELECT id, name, description, logo_url, captain_id, join_password_hash, status, credit_score, vip_until, created_at, updated_at
            FROM rs_teams WHERE name = $1
            "#,
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(Team::from))
    }

    async fn list(&self, active_only: bool) -> Result<Vec<Team>, DomainError> {
        let rows = if active_only {
            sqlx::query_as::<_, TeamRow>(
                r#"SELECT id, name, description, logo_url, captain_id, join_password_hash, status, created_at, updated_at
                   , credit_score, vip_until
                   FROM rs_teams WHERE status = 1 ORDER BY created_at DESC"#,
            )
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as::<_, TeamRow>(
                r#"SELECT id, name, description, logo_url, captain_id, join_password_hash, status, created_at, updated_at
                   , credit_score, vip_until
                   FROM rs_teams ORDER BY created_at DESC"#,
            )
            .fetch_all(&self.pool)
            .await
        }
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(Team::from).collect())
    }

    async fn search(&self, keyword: &str) -> Result<Vec<Team>, DomainError> {
        let pattern = format!("%{keyword}%");
        let rows = sqlx::query_as::<_, TeamRow>(
            r#"SELECT id, name, description, logo_url, captain_id, join_password_hash, status, credit_score, vip_until, created_at, updated_at
               FROM rs_teams WHERE status = 1 AND name ILIKE $1 ORDER BY created_at DESC"#,
        )
        .bind(pattern)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(Team::from).collect())
    }

    async fn is_member(&self, team_id: i64, user_id: i64) -> Result<bool, DomainError> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM rs_team_members WHERE team_id = $1 AND user_id = $2 AND status = 1",
        )
        .bind(team_id).bind(user_id)
        .fetch_one(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(count > 0)
    }

    async fn get_member_status(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<i8>, DomainError> {
        let status = sqlx::query_scalar::<_, i16>(
            "SELECT status FROM rs_team_members WHERE team_id = $1 AND user_id = $2",
        )
        .bind(team_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(status.map(|s| s as i8))
    }

    async fn list_members(&self, team_id: i64) -> Result<Vec<TeamMember>, DomainError> {
        let rows = sqlx::query_as::<_, TeamMemberRow>(
            r#"SELECT id, team_id, user_id, role, jersey_number, joined_at, status, created_at, updated_at
               FROM rs_team_members WHERE team_id = $1 AND status = 1 ORDER BY joined_at ASC"#,
        )
        .bind(team_id)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(TeamMember::from).collect())
    }

    async fn list_members_for_management(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamMember>, DomainError> {
        let rows = sqlx::query_as::<_, TeamMemberRow>(
            r#"SELECT id, team_id, user_id, role, jersey_number, joined_at, status, created_at, updated_at
               FROM rs_team_members
               WHERE team_id = $1
               ORDER BY
                 CASE WHEN status = 1 THEN 0 ELSE 1 END,
                 CASE role
                   WHEN 'captain'      THEN 0
                   WHEN 'leader'       THEN 1
                   WHEN 'vice_captain' THEN 2
                   ELSE 3
                 END,
                 joined_at ASC"#,
        )
        .bind(team_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(TeamMember::from).collect())
    }

    async fn list_member_attendance_records(
        &self,
        team_id: i64,
        user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<TeamMemberAttendanceRecord>, DomainError> {
        let rows = sqlx::query_as::<_, TeamMemberAttendanceRecordRow>(
            r#"
            SELECT
                BTRIM(a.id) AS activity_id,
                a.name AS activity_name,
                a.holding_date,
                a.location,
                COALESCE(ua.stand, 0)::smallint AS stand,
                COALESCE(ua.registration_count, 0) AS registration_count,
                ua.operation_time,
                (ua.user_id IS NOT NULL) AS registered
            FROM rs_activity a
            LEFT JOIN rs_user_activity ua
                ON BTRIM(ua.activity_id) = BTRIM(a.id)
               AND ua.user_id = $2
            WHERE (a.home_team_id = $1 OR a.away_team_id = $1)
              AND a.status = 2
              AND ($3::date IS NULL OR DATE(a.holding_date) >= $3::date)
              AND ($4::date IS NULL OR DATE(a.holding_date) <= $4::date)
            ORDER BY a.holding_date DESC
            "#,
        )
        .bind(team_id)
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(TeamMemberAttendanceRecord::from)
            .collect())
    }

    async fn list_team_attendance_ranking(
        &self,
        team_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<TeamAttendanceRankingItem>, DomainError> {
        let rows = sqlx::query_as::<_, TeamAttendanceRankingRow>(
            r#"
            WITH team_activities AS (
                SELECT BTRIM(id) AS activity_id
                FROM rs_activity
                WHERE (home_team_id = $1 OR away_team_id = $1)
                  AND status = 2
                  AND ($2::date IS NULL OR DATE(holding_date) >= $2::date)
                  AND ($3::date IS NULL OR DATE(holding_date) <= $3::date)
            )
            SELECT
                tm.user_id,
                COALESCE(NULLIF(u.real_name, ''), NULLIF(u.nickname, ''), u.username) AS user_name,
                NULLIF(u.avatar_url, '') AS avatar_url,
                COUNT(ta.activity_id)::bigint AS total_count,
                COUNT(ua.activity_id) FILTER (WHERE ua.stand = 1)::bigint AS attended_count,
                COUNT(ua.activity_id) FILTER (WHERE ua.stand = 2)::bigint AS leave_count,
                COUNT(ua.activity_id) FILTER (WHERE ua.stand = 3)::bigint AS late_count,
                COUNT(ta.activity_id) FILTER (WHERE ua.user_id IS NULL)::bigint AS unregistered_count
            FROM rs_team_members tm
            JOIN rs_user_info u ON u.id = tm.user_id
            CROSS JOIN team_activities ta
            LEFT JOIN rs_user_activity ua
                ON BTRIM(ua.activity_id) = ta.activity_id
               AND ua.user_id = tm.user_id
            WHERE tm.team_id = $1 AND tm.status = 1
            GROUP BY tm.user_id, tm.joined_at, u.real_name, u.nickname, u.username, u.avatar_url
            ORDER BY attended_count DESC, leave_count ASC, unregistered_count ASC, tm.joined_at ASC
            "#,
        )
        .bind(team_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(TeamAttendanceRankingItem::from)
            .collect())
    }

    async fn list_user_teams(&self, user_id: i64) -> Result<Vec<Team>, DomainError> {
        let rows = sqlx::query_as::<_, TeamRow>(
            r#"SELECT t.id, t.name, t.description, t.logo_url, t.captain_id, t.join_password_hash, t.status, t.credit_score, t.vip_until, t.created_at, t.updated_at
               FROM rs_teams t
               INNER JOIN rs_team_members tm ON tm.team_id = t.id
               WHERE tm.user_id = $1 AND tm.status = 1 AND t.status = 1
               ORDER BY t.created_at DESC"#,
        )
        .bind(user_id)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(Team::from).collect())
    }

    async fn list_members_with_info(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamMemberWithInfo>, DomainError> {
        let rows = sqlx::query_as::<_, TeamMemberWithInfoRow>(
            r#"
            SELECT tm.user_id, tm.role, tm.jersey_number, tm.joined_at,
                   u.nickname, u.real_name, u.avatar_url, u.phone_number
            FROM rs_team_members tm
            JOIN rs_user_info u ON u.id = tm.user_id
            WHERE tm.team_id = $1 AND tm.status = 1
            ORDER BY
              CASE tm.role
                WHEN 'captain'      THEN 0
                WHEN 'leader'       THEN 1
                WHEN 'vice_captain' THEN 2
                ELSE 3
              END,
              tm.joined_at ASC
            "#,
        )
        .bind(team_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(TeamMemberWithInfo::from).collect())
    }

    async fn list_team_admins_with_info(
        &self,
        team_id: i64,
    ) -> Result<Vec<TeamAdminInfo>, DomainError> {
        let rows = sqlx::query_as::<_, TeamAdminInfoRow>(
            r#"SELECT a.id AS admin_id, a.username, a.nickname
               FROM rs_admin_team_assignment ata
               JOIN rs_admin_user a ON a.id = ata.admin_id
               WHERE ata.team_id = $1
               ORDER BY ata.created_at ASC"#,
        )
        .bind(team_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn is_admin_assigned(&self, team_id: i64, admin_id: i64) -> Result<bool, DomainError> {
        let exists: bool = sqlx::query_scalar(
            r#"SELECT EXISTS(
                 SELECT 1 FROM rs_admin_team_assignment
                 WHERE team_id = $1 AND admin_id = $2
               )"#,
        )
        .bind(team_id)
        .bind(admin_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(exists)
    }

    async fn list_teams_by_admin(&self, admin_id: i64) -> Result<Vec<Team>, DomainError> {
        let rows = sqlx::query_as::<_, TeamRow>(
            r#"SELECT t.id, t.name, t.description, t.logo_url, t.captain_id,
                      t.join_password_hash, t.status, t.credit_score, t.vip_until, t.created_at, t.updated_at
               FROM rs_teams t
               JOIN rs_admin_team_assignment ata ON ata.team_id = t.id
               WHERE ata.admin_id = $1
               ORDER BY t.created_at DESC"#,
        )
        .bind(admin_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(Team::from).collect())
    }

    async fn list_credit_transactions(
        &self,
        team_id: i64,
        limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, DomainError> {
        let rows = sqlx::query_as::<_, TeamCreditTransactionRow>(
            r#"
            SELECT
                id,
                team_id,
                activity_id,
                transaction_type,
                delta,
                score_before,
                score_after,
                rating,
                amount,
                membership_months,
                note,
                reviewer_team_id,
                created_by_user_id,
                created_by_admin_id,
                created_at
            FROM rs_team_credit_transactions
            WHERE team_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT $2
            "#,
        )
        .bind(team_id)
        .bind(limit.max(1))
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(TeamCreditTransaction::from).collect())
    }

    async fn find_activity_review(
        &self,
        activity_id: &str,
        reviewer_team_id: i64,
    ) -> Result<Option<ActivityTeamReview>, DomainError> {
        let row = sqlx::query_as::<_, ActivityTeamReviewRow>(
            r#"
            SELECT
                id,
                activity_id,
                reviewer_team_id,
                reviewer_user_id,
                reviewee_team_id,
                rating,
                credit_delta,
                comment,
                created_at,
                updated_at
            FROM rs_activity_team_reviews
            WHERE activity_id = $1 AND reviewer_team_id = $2
            "#,
        )
        .bind(activity_id)
        .bind(reviewer_team_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(ActivityTeamReview::from))
    }
}
