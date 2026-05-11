use crate::auth::domain::{AdminUser, DomainError};
use crate::auth::ports::AdminUserRepository;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::{FromRow, PgPool};

#[derive(Debug, FromRow)]
struct AdminUserRow {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub nickname: String,
    pub status: i16,
    pub is_super_admin: i16,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub last_login_time: Option<NaiveDateTime>,
}

impl From<AdminUserRow> for AdminUser {
    fn from(row: AdminUserRow) -> Self {
        Self {
            id: row.id,
            username: row.username,
            password_hash: row.password_hash,
            nickname: row.nickname,
            status: row.status as i8,
            is_super_admin: row.is_super_admin as i8,
            created_at: row.created_at,
            updated_at: row.updated_at,
            last_login_time: row.last_login_time,
        }
    }
}

#[derive(Clone)]
pub struct PostgresAdminUserRepository {
    pool: PgPool,
}

impl PostgresAdminUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AdminUserRepository for PostgresAdminUserRepository {
    async fn find_by_id(&self, admin_id: i64) -> Result<Option<AdminUser>, DomainError> {
        let row = sqlx::query_as::<_, AdminUserRow>(
            r#"
            SELECT
                id, username, password_hash, nickname, status, is_super_admin,
                created_at, updated_at, last_login_time
            FROM rs_admin_user
            WHERE id = $1
            "#,
        )
        .bind(admin_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(AdminUser::from))
    }

    async fn find_by_username(&self, username: &str) -> Result<Option<AdminUser>, DomainError> {
        let row = sqlx::query_as::<_, AdminUserRow>(
            r#"
            SELECT
                id, username, password_hash, nickname, status, is_super_admin,
                created_at, updated_at, last_login_time
            FROM rs_admin_user
            WHERE username = $1
            "#,
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(AdminUser::from))
    }

    async fn list(&self) -> Result<Vec<AdminUser>, DomainError> {
        let rows = sqlx::query_as::<_, AdminUserRow>(
            r#"
            SELECT
                id, username, password_hash, nickname, status, is_super_admin,
                created_at, updated_at, last_login_time
            FROM rs_admin_user
            ORDER BY status ASC, created_at ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows.into_iter().map(AdminUser::from).collect())
    }

    async fn create(
        &self,
        username: &str,
        password_hash: &str,
        nickname: &str,
        is_super_admin: bool,
    ) -> Result<AdminUser, DomainError> {
        let id: i64 = sqlx::query_scalar(
            r#"
            INSERT INTO rs_admin_user (username, password_hash, nickname, status, is_super_admin, created_at, updated_at)
            VALUES ($1, $2, $3, 1, $4, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(username)
        .bind(password_hash)
        .bind(nickname)
        .bind(if is_super_admin { 1_i16 } else { 0_i16 })
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e
                && db.code().as_deref() == Some("23505")
            {
                return DomainError::AdminAlreadyExists;
            }
            DomainError::Infrastructure(e.to_string())
        })?;

        self.find_by_id(id)
            .await?
            .ok_or_else(|| DomainError::Infrastructure("创建管理员后读取失败".to_string()))
    }

    async fn update_status(&self, admin_id: i64, status: i8) -> Result<(), DomainError> {
        sqlx::query("UPDATE rs_admin_user SET status = $1, updated_at = NOW() WHERE id = $2")
            .bind(status as i16)
            .bind(admin_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, admin_id: i64) -> Result<(), DomainError> {
        sqlx::query("DELETE FROM rs_admin_user WHERE id = $1")
            .bind(admin_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn update_last_login(&self, admin_id: i64) -> Result<(), DomainError> {
        sqlx::query("UPDATE rs_admin_user SET last_login_time = NOW() WHERE id = $1")
            .bind(admin_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}
