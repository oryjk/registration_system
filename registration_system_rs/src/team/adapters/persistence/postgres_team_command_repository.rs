use super::models::TeamRow;
use crate::team::domain::{DomainError, Team, UpdateTeamFields};
use crate::team::ports::{ActivityReviewRecord, MembershipRechargeRecord, TeamCommandRepository};
use async_trait::async_trait;
use sqlx::{PgPool, Postgres, Transaction};

#[derive(Clone)]
pub struct PostgresTeamCommandRepository {
    pool: PgPool,
}

impl PostgresTeamCommandRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn fetch_team_in_tx(
        tx: &mut Transaction<'_, Postgres>,
        team_id: i64,
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
impl TeamCommandRepository for PostgresTeamCommandRepository {
    async fn create(&self, team: &Team) -> Result<Team, DomainError> {
        let row = sqlx::query_as::<_, TeamRow>(
            r#"
            INSERT INTO rs_teams (
                name, description, logo_url, captain_id, join_password_hash, status, credit_score, vip_until, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, name, description, logo_url, captain_id, join_password_hash, status, credit_score, vip_until, created_at, updated_at
            "#,
        )
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
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e
                && db.code().as_deref() == Some("23505")
            {
                return DomainError::NameAlreadyExists;
            }
            DomainError::Infrastructure(e.to_string())
        })?;
        Ok(Team::from(row))
    }

    async fn update(&self, team_id: i64, fields: UpdateTeamFields<'_>) -> Result<(), DomainError> {
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

    async fn delete(&self, team_id: i64) -> Result<(), DomainError> {
        sqlx::query("DELETE FROM rs_teams WHERE id = $1")
            .bind(team_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn add_member(
        &self,
        team_id: i64,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
    ) -> Result<(), DomainError> {
        sqlx::query(
            r#"INSERT INTO rs_team_members (team_id, user_id, role, jersey_number, joined_at, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, NOW(), 1, NOW(), NOW())"#,
        )
        .bind(team_id)
        .bind(user_id)
        .bind(role)
        .bind(jersey_number)
        .execute(&self.pool)
        .await
        .map_err(|e| {
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
        team_id: i64,
        user_id: i64,
        role: &str,
        jersey_number: Option<&str>,
    ) -> Result<(), DomainError> {
        sqlx::query(
            r#"UPDATE rs_team_members SET status = 1, role = $1, jersey_number = $2, joined_at = NOW(), updated_at = NOW()
               WHERE team_id = $3 AND user_id = $4"#,
        )
        .bind(role)
        .bind(jersey_number)
        .bind(team_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn remove_member(&self, team_id: i64, user_id: i64) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE rs_team_members SET status = 0, updated_at = NOW() WHERE team_id = $1 AND user_id = $2",
        )
        .bind(team_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn batch_remove_members(
        &self,
        team_id: i64,
        user_ids: &[i64],
    ) -> Result<u64, DomainError> {
        let result = sqlx::query(
            "UPDATE rs_team_members SET status = 0, updated_at = NOW() WHERE team_id = $1 AND user_id = ANY($2)",
        )
        .bind(team_id)
        .bind(user_ids)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(result.rows_affected())
    }

    async fn update_member(
        &self,
        team_id: i64,
        user_id: i64,
        role: Option<&str>,
        jersey_number: Option<Option<&str>>,
    ) -> Result<(), DomainError> {
        if let Some(value) = role {
            sqlx::query(
                "UPDATE rs_team_members SET role = $1, updated_at = NOW() WHERE team_id = $2 AND user_id = $3",
            )
            .bind(value)
            .bind(team_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        if let Some(value) = jersey_number {
            sqlx::query(
                "UPDATE rs_team_members SET jersey_number = $1, updated_at = NOW() WHERE team_id = $2 AND user_id = $3",
            )
            .bind(value)
            .bind(team_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }
        Ok(())
    }

    async fn batch_update_member_status(
        &self,
        team_id: i64,
        user_ids: &[i64],
        status: i8,
    ) -> Result<u64, DomainError> {
        let result = sqlx::query(
            "UPDATE rs_team_members SET status = $1, updated_at = NOW() WHERE team_id = $2 AND user_id = ANY($3) AND status = 1",
        )
        .bind(status as i16)
        .bind(team_id)
        .bind(user_ids)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(result.rows_affected())
    }

    async fn assign_admin(&self, team_id: i64, admin_id: i64) -> Result<(), DomainError> {
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

    async fn unassign_admin(&self, team_id: i64, admin_id: i64) -> Result<(), DomainError> {
        sqlx::query(r#"DELETE FROM rs_admin_team_assignment WHERE team_id = $1 AND admin_id = $2"#)
            .bind(team_id)
            .bind(admin_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
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
        team_id: i64,
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
