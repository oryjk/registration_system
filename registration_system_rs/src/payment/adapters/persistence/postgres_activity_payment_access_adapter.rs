use crate::payment::domain::DomainError;
use crate::payment::ports::{ActivityPaymentAcceptance, ActivityPaymentAccessPort};
use async_trait::async_trait;
use sqlx::PgPool;

#[derive(Clone)]
pub struct PostgresActivityPaymentAccessAdapter {
    pool: PgPool,
}

impl PostgresActivityPaymentAccessAdapter {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ActivityPaymentAccessPort for PostgresActivityPaymentAccessAdapter {
    async fn find_individual_acceptance(
        &self,
        challenge_id: &str,
        user_id: i64,
    ) -> Result<Option<ActivityPaymentAcceptance>, DomainError> {
        let row = sqlx::query_as::<_, ActivityPaymentAcceptanceRow>(
            r#"
            SELECT
                c.id AS challenge_id,
                a.user_id,
                c.title,
                COALESCE(c.fee_per_person, 0.00) AS amount,
                a.payment_status,
                a.payment_deadline_at
            FROM rs_challenge_individual_acceptances a
            INNER JOIN rs_challenges c ON c.id = a.challenge_id
            WHERE a.challenge_id = $1
              AND a.user_id = $2
              AND c.kind = 'individual'
            "#,
        )
        .bind(challenge_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(ActivityPaymentAcceptance::from))
    }

    async fn attach_payment_order(
        &self,
        challenge_id: &str,
        user_id: i64,
        order_no: &str,
    ) -> Result<(), DomainError> {
        let result = sqlx::query(
            r#"
            UPDATE rs_challenge_individual_acceptances
            SET payment_order_no = $3,
                updated_at = NOW()
            WHERE challenge_id = $1
              AND user_id = $2
              AND payment_status = 'unpaid'
            "#,
        )
        .bind(challenge_id)
        .bind(user_id)
        .bind(order_no)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(DomainError::Infrastructure(
                "散人报名支付记录不存在或已不可支付".to_string(),
            ));
        }

        Ok(())
    }
}

#[derive(Debug, sqlx::FromRow)]
struct ActivityPaymentAcceptanceRow {
    challenge_id: String,
    user_id: i64,
    title: String,
    amount: rust_decimal::Decimal,
    payment_status: String,
    payment_deadline_at: Option<chrono::NaiveDateTime>,
}

impl From<ActivityPaymentAcceptanceRow> for ActivityPaymentAcceptance {
    fn from(row: ActivityPaymentAcceptanceRow) -> Self {
        Self {
            challenge_id: row.challenge_id,
            user_id: row.user_id,
            title: row.title,
            amount: row.amount,
            payment_status: row.payment_status,
            payment_deadline_at: row.payment_deadline_at,
        }
    }
}
