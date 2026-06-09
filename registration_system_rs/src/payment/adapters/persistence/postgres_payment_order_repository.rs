use crate::payment::domain::{
    DomainError, PaymentOrder, PaymentOrderStatus, PaymentOrderType, TeamMembershipPaymentOrder,
};
use crate::payment::ports::{PaymentOrderCommandRepository, PaymentOrderQueryRepository};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};

#[derive(Clone)]
pub struct PostgresPaymentOrderRepository {
    pool: PgPool,
}

impl PostgresPaymentOrderRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    fn map_row(row: sqlx::postgres::PgRow) -> PaymentOrder {
        PaymentOrder {
            id: Some(row.get::<i64, _>("id")),
            order_no: row.get::<String, _>("order_no"),
            user_id: row.get::<i64, _>("user_id"),
            amount: row.get::<Decimal, _>("amount"),
            order_type: PaymentOrderType::from_db_str(&row.get::<String, _>("payment_type")),
            status: PaymentOrderStatus::from_db_str(&row.get::<String, _>("status")),
            prepay_id: row.get::<Option<String>, _>("prepay_id"),
            transaction_id: row.get::<Option<String>, _>("transaction_id"),
            description: row.get::<Option<String>, _>("description"),
            paid_at: row.get::<Option<NaiveDateTime>, _>("paid_at"),
            cancelled_at: row.get::<Option<NaiveDateTime>, _>("cancelled_at"),
            created_at: row.get::<Option<NaiveDateTime>, _>("created_at"),
            updated_at: row.get::<Option<NaiveDateTime>, _>("updated_at"),
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct TeamMembershipOrderRow {
    order_no: String,
    team_id: i64,
    user_id: i64,
    months: i32,
    credit_delta: i32,
    amount: Decimal,
    note: Option<String>,
    applied_at: Option<NaiveDateTime>,
}

impl From<TeamMembershipOrderRow> for TeamMembershipPaymentOrder {
    fn from(row: TeamMembershipOrderRow) -> Self {
        Self {
            order_no: row.order_no,
            team_id: row.team_id,
            user_id: row.user_id,
            months: row.months,
            credit_delta: row.credit_delta,
            amount: row.amount,
            note: row.note,
            applied_at: row.applied_at,
        }
    }
}

const ORDER_COLS: &str = "id, order_no, user_id, amount, payment_type, status, prepay_id, transaction_id, description, paid_at, cancelled_at, created_at, updated_at";

#[async_trait]
impl PaymentOrderQueryRepository for PostgresPaymentOrderRepository {
    async fn find_by_order_no(&self, order_no: &str) -> Result<Option<PaymentOrder>, DomainError> {
        let row = sqlx::query(&format!(
            "SELECT {ORDER_COLS} FROM rs_payment_orders WHERE order_no = $1"
        ))
        .bind(order_no)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(Self::map_row))
    }

    async fn find_by_user_id(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<PaymentOrder>, DomainError> {
        let rows = sqlx::query(&format!(
            "SELECT {ORDER_COLS} FROM rs_payment_orders WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2"
        ))
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(Self::map_row).collect())
    }

    async fn find_team_membership_order(
        &self,
        order_no: &str,
    ) -> Result<Option<TeamMembershipPaymentOrder>, DomainError> {
        let row = sqlx::query_as::<_, TeamMembershipOrderRow>(
            r#"
            SELECT order_no, team_id, user_id, months, credit_delta, amount, note, applied_at
            FROM rs_team_membership_orders
            WHERE order_no = $1
            "#,
        )
        .bind(order_no)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(TeamMembershipPaymentOrder::from))
    }
}

#[async_trait]
impl PaymentOrderCommandRepository for PostgresPaymentOrderRepository {
    async fn create(&self, order: &PaymentOrder) -> Result<i64, DomainError> {
        let id: i64 = sqlx::query_scalar(
            r#"INSERT INTO rs_payment_orders (order_no, user_id, amount, payment_type, status, prepay_id, transaction_id, description, created_at, updated_at, paid_at, cancelled_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NULL, NULL)
               RETURNING id"#,
        )
        .bind(&order.order_no)
        .bind(order.user_id)
        .bind(order.amount)
        .bind(order.order_type.as_db_str())
        .bind(order.status.as_db_str())
        .bind(&order.prepay_id)
        .bind(&order.transaction_id)
        .bind(&order.description)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db) = &e
                && db.code().as_deref() == Some("23505")
            {
                return DomainError::DuplicateOrder;
            }
            DomainError::Infrastructure(e.to_string())
        })?;
        Ok(id)
    }

    async fn update_status(
        &self,
        order_no: &str,
        status: PaymentOrderStatus,
    ) -> Result<(), DomainError> {
        let query = if status == PaymentOrderStatus::Cancelled {
            sqlx::query(
                "UPDATE rs_payment_orders SET status = $1, cancelled_at = NOW(), updated_at = NOW() WHERE order_no = $2",
            )
        } else {
            sqlx::query(
                "UPDATE rs_payment_orders SET status = $1, updated_at = NOW() WHERE order_no = $2",
            )
        };
        query
            .bind(status.as_db_str())
            .bind(order_no)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn update_payment_info(
        &self,
        order_no: &str,
        prepay_id: &str,
        transaction_id: Option<&str>,
    ) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE rs_payment_orders SET prepay_id = $1, transaction_id = $2, updated_at = NOW() WHERE order_no = $3",
        )
        .bind(prepay_id)
        .bind(transaction_id)
        .bind(order_no)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn mark_as_paid(
        &self,
        order_no: &str,
        transaction_id: &str,
        paid_at: NaiveDateTime,
    ) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE rs_payment_orders SET status = $1, transaction_id = $2, paid_at = COALESCE(paid_at, $3), updated_at = NOW() WHERE order_no = $4",
        )
        .bind(PaymentOrderStatus::Paid.as_db_str())
        .bind(transaction_id)
        .bind(paid_at)
        .bind(order_no)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn create_team_membership_order(
        &self,
        order: &TeamMembershipPaymentOrder,
    ) -> Result<i64, DomainError> {
        sqlx::query_scalar(
            r#"
            INSERT INTO rs_team_membership_orders (
                order_no, team_id, user_id, months, credit_delta, amount, note, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(&order.order_no)
        .bind(order.team_id)
        .bind(order.user_id)
        .bind(order.months)
        .bind(order.credit_delta)
        .bind(order.amount)
        .bind(&order.note)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))
    }
}
