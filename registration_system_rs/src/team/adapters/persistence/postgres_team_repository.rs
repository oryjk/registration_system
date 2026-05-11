use crate::team::domain::{
    ActivityTeamReview, DomainError, Team, TeamAdminInfo, TeamCreditTransaction, TeamMember,
    TeamMemberWithInfo, UpdateTeamFields,
};
use crate::team::ports::{ActivityReviewRecord, MembershipRechargeRecord, TeamRepository};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;
use sqlx::{FromRow, PgPool, Postgres, Transaction};

#[derive(Debug, FromRow)]
struct TeamRow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub captain_id: Option<i64>,
    pub join_password_hash: Option<String>,
    pub status: i16,
    pub credit_score: i32,
    pub vip_until: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<TeamRow> for Team {
    fn from(row: TeamRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            description: row.description,
            logo_url: row.logo_url,
            captain_id: row.captain_id,
            join_password_hash: row.join_password_hash,
            status: row.status as i8,
            credit_score: row.credit_score,
            vip_until: row.vip_until,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct TeamMemberRow {
    pub id: i64,
    pub team_id: String,
    pub user_id: i64,
    pub role: String,
    pub jersey_number: Option<String>,
    pub joined_at: NaiveDateTime,
    pub status: i16,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, FromRow)]
struct TeamCreditTransactionRow {
    pub id: i64,
    pub team_id: String,
    pub activity_id: Option<String>,
    pub transaction_type: String,
    pub delta: i32,
    pub score_before: i32,
    pub score_after: i32,
    pub rating: Option<i16>,
    pub amount: Option<Decimal>,
    pub membership_months: Option<i32>,
    pub note: Option<String>,
    pub reviewer_team_id: Option<String>,
    pub created_by_user_id: Option<i64>,
    pub created_by_admin_id: Option<i64>,
    pub created_at: NaiveDateTime,
}

impl From<TeamCreditTransactionRow> for TeamCreditTransaction {
    fn from(row: TeamCreditTransactionRow) -> Self {
        Self {
            id: row.id,
            team_id: row.team_id,
            activity_id: row.activity_id,
            transaction_type: row.transaction_type,
            delta: row.delta,
            score_before: row.score_before,
            score_after: row.score_after,
            rating: row.rating.map(|value| value as i8),
            amount: row.amount,
            membership_months: row.membership_months,
            note: row.note,
            reviewer_team_id: row.reviewer_team_id,
            created_by_user_id: row.created_by_user_id,
            created_by_admin_id: row.created_by_admin_id,
            created_at: row.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct ActivityTeamReviewRow {
    pub id: i64,
    pub activity_id: String,
    pub reviewer_team_id: String,
    pub reviewer_user_id: i64,
    pub reviewee_team_id: String,
    pub rating: i16,
    pub credit_delta: i32,
    pub comment: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<ActivityTeamReviewRow> for ActivityTeamReview {
    fn from(row: ActivityTeamReviewRow) -> Self {
        Self {
            id: row.id,
            activity_id: row.activity_id,
            reviewer_team_id: row.reviewer_team_id,
            reviewer_user_id: row.reviewer_user_id,
            reviewee_team_id: row.reviewee_team_id,
            rating: row.rating as i8,
            credit_delta: row.credit_delta,
            comment: row.comment,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

impl From<TeamMemberRow> for TeamMember {
    fn from(row: TeamMemberRow) -> Self {
        Self {
            id: row.id,
            team_id: row.team_id,
            user_id: row.user_id,
            role: row.role,
            jersey_number: row.jersey_number,
            joined_at: row.joined_at,
            status: row.status as i8,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Clone)]
pub struct PostgresTeamRepository {
    pool: PgPool,
}

impl PostgresTeamRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn fetch_team_in_tx(
        tx: &mut Transaction<'_, Postgres>,
        team_id: &str,
    ) -> Result<Team, DomainError> {
        sqlx::query_as::<_, TeamRow>(
            r#"
            SELECT id, name, description, logo_url, captain_id, join_password_hash, status, credit_score, vip_until, created_at, updated_at
            FROM rs_teams
            WHERE id = $1
            "#,
        )
        .bind(team_id)
        .fetch_one(&mut **tx)
        .await
        .map(Team::from)
        .map_err(|e| DomainError::Infrastructure(e.to_string()))
    }
}

#[async_trait]
impl TeamRepository for PostgresTeamRepository {
    async fn create(&self, team: &Team) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO rs_teams (
                id, name, description, logo_url, captain_id, join_password_hash, status, credit_score, vip_until, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            "#,
        )
        .bind(&team.id)
        .bind(&team.name)
        .bind(&team.description)
        .bind(&team.logo_url)
        .bind(team.captain_id)
        .bind(&team.join_password_hash)
        .bind(team.status as i16)
        .bind(team.credit_score)
        .bind(team.vip_until)
        .bind(team.created_at)
        .bind(team.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e
                && db.code().as_deref() == Some("23505")
            {
                return DomainError::NameAlreadyExists;
            }
            DomainError::Infrastructure(e.to_string())
        })?;
        Ok(())
    }

    async fn find_by_id(&self, team_id: &str) -> Result<Option<Team>, DomainError> {
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

    async fn update(&self, team_id: &str, fields: UpdateTeamFields<'_>) -> Result<(), DomainError> {
        if let Some(value) = fields.name {
            sqlx::query("UPDATE rs_teams SET name = $1, updated_at = NOW() WHERE id = $2")
                .bind(value)
                .bind(team_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.description {
            sqlx::query("UPDATE rs_teams SET description = $1, updated_at = NOW() WHERE id = $2")
                .bind(value)
                .bind(team_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.logo_url {
            sqlx::query("UPDATE rs_teams SET logo_url = $1, updated_at = NOW() WHERE id = $2")
                .bind(value)
                .bind(team_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.captain_id {
            sqlx::query("UPDATE rs_teams SET captain_id = $1, updated_at = NOW() WHERE id = $2")
                .bind(value)
                .bind(team_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.status {
            sqlx::query("UPDATE rs_teams SET status = $1, updated_at = NOW() WHERE id = $2")
                .bind(value as i16)
                .bind(team_id)
                .execute(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = fields.join_password_hash {
            sqlx::query(
                "UPDATE rs_teams SET join_password_hash = $1, updated_at = NOW() WHERE id = $2",
            )
            .bind(value)
            .bind(team_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        Ok(())
    }

    async fn delete(&self, team_id: &str) -> Result<(), DomainError> {
        sqlx::query("DELETE FROM rs_teams WHERE id = $1")
            .bind(team_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn add_member(
        &self,
        team_id: &str,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
    ) -> Result<(), DomainError> {
        sqlx::query(
            r#"INSERT INTO rs_team_members (team_id, user_id, role, jersey_number, joined_at, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, NOW(), 1, NOW(), NOW())"#,
        )
        .bind(team_id).bind(user_id).bind(role).bind(jersey_number)
        .execute(&self.pool).await.map_err(|e| {
            if let sqlx::Error::Database(db) = &e
                && db.code().as_deref() == Some("23505")
            {
                return DomainError::AlreadyMember;
            }
            DomainError::Infrastructure(e.to_string())
        })?;
        Ok(())
    }

    async fn reactivate_member(
        &self,
        team_id: &str,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
    ) -> Result<(), DomainError> {
        sqlx::query(
            r#"UPDATE rs_team_members SET status = 1, role = $1, jersey_number = $2, joined_at = NOW(), updated_at = NOW()
               WHERE team_id = $3 AND user_id = $4"#,
        )
        .bind(role).bind(jersey_number).bind(team_id).bind(user_id)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn remove_member(&self, team_id: &str, user_id: i64) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE rs_team_members SET status = 0, updated_at = NOW() WHERE team_id = $1 AND user_id = $2",
        )
        .bind(team_id).bind(user_id)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn batch_remove_members(
        &self,
        team_id: &str,
        user_ids: &[i64],
    ) -> Result<u64, DomainError> {
        let result = sqlx::query(
            "UPDATE rs_team_members SET status = 0, updated_at = NOW() WHERE team_id = $1 AND user_id = ANY($2)",
        )
        .bind(team_id).bind(user_ids)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(result.rows_affected())
    }

    async fn update_member(
        &self,
        team_id: &str,
        user_id: i64,
        role: Option<&str>,
        jersey_number: Option<Option<&str>>,
    ) -> Result<(), DomainError> {
        if let Some(value) = role {
            sqlx::query(
                "UPDATE rs_team_members SET role = $1, updated_at = NOW() WHERE team_id = $2 AND user_id = $3",
            )
            .bind(value).bind(team_id).bind(user_id)
            .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = jersey_number {
            sqlx::query(
                "UPDATE rs_team_members SET jersey_number = $1, updated_at = NOW() WHERE team_id = $2 AND user_id = $3",
            )
            .bind(value).bind(team_id).bind(user_id)
            .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        Ok(())
    }

    async fn batch_update_member_status(
        &self,
        team_id: &str,
        user_ids: &[i64],
        status: i8,
    ) -> Result<u64, DomainError> {
        let result = sqlx::query(
            "UPDATE rs_team_members SET status = $1, updated_at = NOW() WHERE team_id = $2 AND user_id = ANY($3) AND status = 1",
        )
        .bind(status as i16).bind(team_id).bind(user_ids)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(result.rows_affected())
    }

    async fn is_member(&self, team_id: &str, user_id: i64) -> Result<bool, DomainError> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM rs_team_members WHERE team_id = $1 AND user_id = $2 AND status = 1",
        )
        .bind(team_id).bind(user_id)
        .fetch_one(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(count > 0)
    }

    async fn get_member_status(
        &self,
        team_id: &str,
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

    async fn list_members(&self, team_id: &str) -> Result<Vec<TeamMember>, DomainError> {
        let rows = sqlx::query_as::<_, TeamMemberRow>(
            r#"SELECT id, team_id, user_id, role, jersey_number, joined_at, status, created_at, updated_at
               FROM rs_team_members WHERE team_id = $1 AND status = 1 ORDER BY joined_at ASC"#,
        )
        .bind(team_id)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(TeamMember::from).collect())
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
        team_id: &str,
    ) -> Result<Vec<TeamMemberWithInfo>, DomainError> {
        #[derive(Debug, FromRow)]
        struct MemberWithInfoRow {
            user_id: i64,
            role: String,
            jersey_number: Option<String>,
            joined_at: NaiveDateTime,
            nickname: String,
            real_name: String,
            avatar_url: String,
            phone_number: String,
        }

        let rows = sqlx::query_as::<_, MemberWithInfoRow>(
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

        Ok(rows
            .into_iter()
            .map(|r| TeamMemberWithInfo {
                user_id: r.user_id,
                role: r.role,
                jersey_number: r.jersey_number,
                joined_at: r.joined_at,
                nickname: r.nickname,
                real_name: r.real_name,
                avatar_url: r.avatar_url,
                phone_number: r.phone_number,
            })
            .collect())
    }

    async fn assign_admin(&self, team_id: &str, admin_id: i64) -> Result<(), DomainError> {
        sqlx::query(
            r#"INSERT INTO rs_admin_team_assignment (admin_id, team_id)
               VALUES ($1, $2)
               ON CONFLICT (admin_id, team_id) DO NOTHING"#,
        )
        .bind(admin_id)
        .bind(team_id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn unassign_admin(&self, team_id: &str, admin_id: i64) -> Result<(), DomainError> {
        sqlx::query(r#"DELETE FROM rs_admin_team_assignment WHERE team_id = $1 AND admin_id = $2"#)
            .bind(team_id)
            .bind(admin_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn list_team_admins_with_info(
        &self,
        team_id: &str,
    ) -> Result<Vec<TeamAdminInfo>, DomainError> {
        #[derive(Debug, sqlx::FromRow)]
        struct Row {
            admin_id: i64,
            username: String,
            nickname: String,
        }

        let rows = sqlx::query_as::<_, Row>(
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

        Ok(rows
            .into_iter()
            .map(|r| TeamAdminInfo {
                admin_id: r.admin_id,
                username: r.username,
                nickname: r.nickname,
            })
            .collect())
    }

    async fn is_admin_assigned(&self, team_id: &str, admin_id: i64) -> Result<bool, DomainError> {
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
        team_id: &str,
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
        reviewer_team_id: &str,
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

    async fn record_activity_review(
        &self,
        record: ActivityReviewRecord<'_>,
    ) -> Result<Team, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO rs_activity_team_reviews (
                activity_id,
                reviewer_team_id,
                reviewer_user_id,
                reviewee_team_id,
                rating,
                credit_delta,
                comment,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            "#,
        )
        .bind(record.activity_id)
        .bind(record.reviewer_team_id)
        .bind(record.reviewer_user_id)
        .bind(record.reviewee_team_id)
        .bind(record.rating as i16)
        .bind(record.credit_delta)
        .bind(record.comment)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"
            UPDATE rs_teams
            SET credit_score = $1, updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(record.score_after)
        .bind(record.reviewee_team_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO rs_team_credit_transactions (
                team_id,
                activity_id,
                transaction_type,
                delta,
                score_before,
                score_after,
                rating,
                note,
                reviewer_team_id,
                created_by_user_id,
                created_at
            ) VALUES ($1, $2, 'match_review', $3, $4, $5, $6, $7, $8, $9, NOW())
            "#,
        )
        .bind(record.reviewee_team_id)
        .bind(record.activity_id)
        .bind(record.credit_delta)
        .bind(record.score_before)
        .bind(record.score_after)
        .bind(record.rating as i16)
        .bind(record.comment)
        .bind(record.reviewer_team_id)
        .bind(record.reviewer_user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let team = Self::fetch_team_in_tx(&mut tx, record.reviewee_team_id).await?;
        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(team)
    }

    async fn record_membership_recharge(
        &self,
        record: MembershipRechargeRecord<'_>,
    ) -> Result<Team, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"
            UPDATE rs_teams
            SET credit_score = $1, vip_until = $2, updated_at = NOW()
            WHERE id = $3
            "#,
        )
        .bind(record.score_after)
        .bind(record.vip_until)
        .bind(record.team_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO rs_team_credit_transactions (
                team_id,
                transaction_type,
                delta,
                score_before,
                score_after,
                amount,
                membership_months,
                note,
                created_by_user_id,
                created_at
            ) VALUES ($1, 'membership_recharge', $2, $3, $4, $5, $6, $7, $8, NOW())
            "#,
        )
        .bind(record.team_id)
        .bind(record.credit_delta)
        .bind(record.score_before)
        .bind(record.score_after)
        .bind(record.amount)
        .bind(record.months)
        .bind(record.note)
        .bind(record.operator_user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let team = Self::fetch_team_in_tx(&mut tx, record.team_id).await?;
        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(team)
    }

    async fn record_credit_penalty(
        &self,
        team_id: &str,
        admin_id: i64,
        points: i32,
        reason: &str,
        score_before: i32,
        score_after: i32,
    ) -> Result<Team, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"
            UPDATE rs_teams
            SET credit_score = $1, updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(score_after)
        .bind(team_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO rs_team_credit_transactions (
                team_id,
                transaction_type,
                delta,
                score_before,
                score_after,
                note,
                created_by_admin_id,
                created_at
            ) VALUES ($1, 'manual_penalty', $2, $3, $4, $5, $6, NOW())
            "#,
        )
        .bind(team_id)
        .bind(-points)
        .bind(score_before)
        .bind(score_after)
        .bind(reason)
        .bind(admin_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let team = Self::fetch_team_in_tx(&mut tx, team_id).await?;
        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(team)
    }
}
