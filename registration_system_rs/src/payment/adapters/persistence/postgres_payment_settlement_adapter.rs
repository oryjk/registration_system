use crate::payment::domain::DomainError;
use crate::payment::ports::{
    ActivityPaymentSettlement, PaymentSettlementPort, RechargePaymentSettlement,
    TeamMembershipPaymentSettlement,
};
use async_trait::async_trait;
use chrono::Duration;
use sqlx::PgPool;

#[derive(Clone)]
pub struct PostgresPaymentSettlementAdapter {
    pool: PgPool,
}

impl PostgresPaymentSettlementAdapter {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PaymentSettlementPort for PostgresPaymentSettlementAdapter {
    async fn settle_recharge_payment(
        &self,
        settlement: RechargePaymentSettlement<'_>,
    ) -> Result<(), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"INSERT INTO rs_user_accounts (user_id, balance, total_recharge, total_expense, total_penalty, last_updated, version, status, created_at, updated_at)
               VALUES ($1, 0.00, 0.00, 0.00, 0.00, NOW(), 1, 1, NOW(), NOW())
               ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()"#,
        )
        .bind(settlement.user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let recharge_record_id = sqlx::query_scalar::<_, i64>(
            r#"
            INSERT INTO rs_recharge_records (
                user_id,
                amount,
                payment_method,
                transaction_no,
                payment_order_no,
                recharge_date,
                description,
                status,
                created_at,
                updated_at
            ) VALUES ($1, $2, 'wechat', $3, $4, CURRENT_DATE, $5, 1, NOW(), NOW())
            ON CONFLICT (payment_order_no) DO NOTHING
            RETURNING id
            "#,
        )
        .bind(settlement.user_id)
        .bind(settlement.amount)
        .bind(settlement.transaction_id)
        .bind(settlement.order_no)
        .bind(settlement.description)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        if recharge_record_id.is_none() {
            tx.commit()
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
            return Ok(());
        }

        sqlx::query(
            "UPDATE rs_user_accounts SET balance = balance + $1, total_recharge = total_recharge + $2, last_updated = NOW(), version = version + 1, updated_at = NOW() WHERE user_id = $3",
        )
        .bind(settlement.amount)
        .bind(settlement.amount)
        .bind(settlement.user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn settle_team_membership_payment(
        &self,
        settlement: TeamMembershipPaymentSettlement<'_>,
    ) -> Result<(), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let existing_applied_at = sqlx::query_scalar::<_, Option<chrono::NaiveDateTime>>(
            "SELECT applied_at FROM rs_team_membership_orders WHERE order_no = $1",
        )
        .bind(settlement.order_no)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?
        .flatten();

        if existing_applied_at.is_some() {
            tx.commit()
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
            return Ok(());
        }

        let team_row = sqlx::query_as::<_, (i32, Option<chrono::NaiveDateTime>)>(
            "SELECT credit_score, vip_until FROM rs_teams WHERE id = $1",
        )
        .bind(settlement.team_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let score_before = team_row.0;
        let score_after = (score_before + settlement.credit_delta).clamp(0, 100);
        let now = chrono::Utc::now().naive_utc();
        let vip_base = team_row.1.filter(|value| *value > now).unwrap_or(now);
        let vip_until = vip_base + Duration::days(i64::from(settlement.months) * 30);

        sqlx::query(
            "UPDATE rs_teams SET credit_score = $1, vip_until = $2, updated_at = NOW() WHERE id = $3",
        )
        .bind(score_after)
        .bind(vip_until)
        .bind(settlement.team_id)
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
        .bind(settlement.team_id)
        .bind(settlement.credit_delta)
        .bind(score_before)
        .bind(score_after)
        .bind(settlement.amount)
        .bind(settlement.months)
        .bind(settlement.note)
        .bind(settlement.user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            "UPDATE rs_team_membership_orders SET applied_at = NOW(), transaction_id = $1, updated_at = NOW() WHERE order_no = $2",
        )
        .bind(settlement.transaction_id)
        .bind(settlement.order_no)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn settle_activity_payment(
        &self,
        settlement: ActivityPaymentSettlement<'_>,
    ) -> Result<(), DomainError> {
        let result = sqlx::query(
            r#"
            UPDATE rs_challenge_individual_acceptances
            SET payment_status = 'paid',
                payment_order_no = $1,
                updated_at = NOW()
            WHERE payment_order_no = $1
              AND user_id = $2
              AND payment_status <> 'cancelled'
            "#,
        )
        .bind(settlement.order_no)
        .bind(settlement.user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(DomainError::Infrastructure(
                "活动支付报名记录不存在".to_string(),
            ));
        }

        let _ = settlement.transaction_id;
        Ok(())
    }
}
