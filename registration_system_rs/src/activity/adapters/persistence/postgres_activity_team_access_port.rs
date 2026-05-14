use crate::activity::ports::ActivityTeamAccessPort;
use async_trait::async_trait;
use sqlx::PgPool;

#[derive(Clone)]
pub struct PostgresActivityTeamAccessPort {
    pool: PgPool,
}

impl PostgresActivityTeamAccessPort {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ActivityTeamAccessPort for PostgresActivityTeamAccessPort {
    async fn find_active_member_role(
        &self,
        team_id: i64,
        user_id: i64,
    ) -> Result<Option<String>, String> {
        let row: Option<(String,)> = sqlx::query_as(
            r#"SELECT role
               FROM rs_team_members
               WHERE team_id = $1 AND user_id = $2 AND status = 1
               LIMIT 1"#,
        )
        .bind(team_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        Ok(row.map(|item| item.0))
    }
}
