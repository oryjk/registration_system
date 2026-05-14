use crate::billing::ports::{ActivitySettlementAccess, BillingActivityAccessPort};
use async_trait::async_trait;
use sqlx::PgPool;

#[derive(Clone)]
pub struct PostgresBillingActivityAccessPort {
    pool: PgPool,
}

impl PostgresBillingActivityAccessPort {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BillingActivityAccessPort for PostgresBillingActivityAccessPort {
    async fn find_activity_settlement_access(
        &self,
        activity_id: &str,
    ) -> Result<Option<ActivitySettlementAccess>, String> {
        let row: Option<(String, Option<i64>, Option<i64>)> = sqlx::query_as(
            r#"
            SELECT BTRIM(id), home_team_id, away_team_id
            FROM rs_activity
            WHERE BTRIM(id) = BTRIM($1)
            LIMIT 1
            "#,
        )
        .bind(activity_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(row.map(
            |(activity_id, home_team_id, away_team_id)| ActivitySettlementAccess {
                activity_id,
                home_team_id,
                away_team_id,
            },
        ))
    }

    async fn find_active_member_role(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<String>, String> {
        let row: Option<(String,)> = sqlx::query_as(
            r#"
            SELECT role
            FROM rs_team_members
            WHERE team_id = $1 AND user_id = $2 AND status = 1
            LIMIT 1
            "#,
        )
        .bind(team_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(row.map(|item| item.0))
    }
}
