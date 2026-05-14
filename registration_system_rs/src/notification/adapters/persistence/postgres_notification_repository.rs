use crate::notification::domain::{DomainError, Notification};
use crate::notification::ports::{NotificationCommandRepository, NotificationQueryRepository};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::{FromRow, PgPool, Postgres, QueryBuilder};

#[derive(Clone)]
pub struct PostgresNotificationRepository {
    pool: PgPool,
}

#[derive(Debug, FromRow)]
struct NotificationRow {
    id: String,
    user_id: i64,
    kind: String,
    title: String,
    content: String,
    related_type: Option<String>,
    related_id: Option<String>,
    read_at: Option<NaiveDateTime>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

impl From<NotificationRow> for Notification {
    fn from(row: NotificationRow) -> Self {
        Self {
            id: row.id,
            user_id: row.user_id,
            kind: row.kind,
            title: row.title,
            content: row.content,
            related_type: row.related_type,
            related_id: row.related_id,
            read_at: row.read_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

impl PostgresNotificationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl NotificationCommandRepository for PostgresNotificationRepository {
    async fn create_many(&self, notifications: &[Notification]) -> Result<(), DomainError> {
        if notifications.is_empty() {
            return Ok(());
        }

        let mut query_builder = QueryBuilder::<Postgres>::new(
            "INSERT INTO rs_user_notifications (id, user_id, kind, title, content, related_type, related_id, read_at, created_at, updated_at) ",
        );
        query_builder.push_values(notifications, |mut builder, item| {
            builder
                .push_bind(&item.id)
                .push_bind(item.user_id)
                .push_bind(&item.kind)
                .push_bind(&item.title)
                .push_bind(&item.content)
                .push_bind(&item.related_type)
                .push_bind(&item.related_id)
                .push_bind(item.read_at)
                .push_bind(item.created_at)
                .push_bind(item.updated_at);
        });

        query_builder
            .build()
            .execute(&self.pool)
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        Ok(())
    }

    async fn mark_all_read(&self, user_id: i64) -> Result<u64, DomainError> {
        let result = sqlx::query(
            r#"
            UPDATE rs_user_notifications
            SET read_at = NOW(), updated_at = NOW()
            WHERE user_id = $1 AND read_at IS NULL
            "#,
        )
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        Ok(result.rows_affected())
    }
}

#[async_trait]
impl NotificationQueryRepository for PostgresNotificationRepository {
    async fn list_for_user(
        &self,
        user_id: i64,
        unread_only: bool,
        limit: i64,
    ) -> Result<Vec<Notification>, DomainError> {
        let rows = sqlx::query_as::<_, NotificationRow>(
            r#"
            SELECT
                id, user_id, kind, title, content, related_type, related_id,
                read_at, created_at, updated_at
            FROM rs_user_notifications
            WHERE user_id = $1
              AND ($2::boolean = false OR read_at IS NULL)
            ORDER BY created_at DESC
            LIMIT $3
            "#,
        )
        .bind(user_id)
        .bind(unread_only)
        .bind(limit.max(1))
        .fetch_all(&self.pool)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        Ok(rows.into_iter().map(Notification::from).collect())
    }

    async fn count_unread(&self, user_id: i64) -> Result<i64, DomainError> {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM rs_user_notifications WHERE user_id = $1 AND read_at IS NULL",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))
    }
}
