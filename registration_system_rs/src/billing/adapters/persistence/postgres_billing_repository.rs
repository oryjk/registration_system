use crate::billing::domain::{
    ActivityBillingSummary, ActivityOrder, ActivitySettlementBatch, ActivitySettlementSummary,
    BalanceCalibrationRecord, BillingFlowRecord, BillingFlowResult, DomainError, PenaltyCandidate,
    TransactionRecord, UserAccount, UserBillingRecord,
};
use crate::billing::ports::BillingRepository;
use async_trait::async_trait;
use chrono::{NaiveDate, NaiveDateTime, Utc};
use rust_decimal::Decimal;
use sqlx::{FromRow, PgPool, Row};

// ---------- DbRow 结构体 ----------

#[derive(Debug, FromRow)]
struct UserAccountRow {
    pub id: i64,
    pub user_id: i64,
    pub balance: Decimal,
    pub total_recharge: Decimal,
    pub total_expense: Decimal,
    pub total_penalty: Decimal,
    pub last_updated: NaiveDateTime,
    pub version: i32,
    pub status: i16,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<UserAccountRow> for UserAccount {
    fn from(row: UserAccountRow) -> Self {
        Self {
            id: row.id,
            user_id: row.user_id,
            balance: row.balance,
            total_recharge: row.total_recharge,
            total_expense: row.total_expense,
            total_penalty: row.total_penalty,
            last_updated: row.last_updated,
            version: row.version,
            status: row.status as i8,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct ActivityOrderRow {
    pub id: i64,
    pub activity_id: String,
    pub description: String,
    pub fee: Decimal,
    pub total: i32,
    pub activity_holding_time: Option<NaiveDateTime>,
    pub create_time: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<ActivityOrderRow> for ActivityOrder {
    fn from(row: ActivityOrderRow) -> Self {
        Self {
            id: row.id,
            activity_id: row.activity_id,
            description: row.description,
            fee: row.fee,
            total: row.total,
            activity_holding_time: row.activity_holding_time,
            create_time: row.create_time,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct UserBillingRecordRow {
    pub id: i64,
    pub user_id: i64,
    pub game_id: String,
    pub fee: Decimal,
    pub billing_type: String,
    pub description: Option<String>,
    pub billing_date: NaiveDate,
    pub status: i16,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<UserBillingRecordRow> for UserBillingRecord {
    fn from(row: UserBillingRecordRow) -> Self {
        Self {
            id: row.id,
            user_id: row.user_id,
            game_id: row.game_id,
            fee: row.fee,
            billing_type: row.billing_type,
            description: row.description,
            billing_date: row.billing_date,
            status: row.status as i8,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct BalanceCalibrationRecordRow {
    pub id: i64,
    pub user_id: i64,
    pub user_name: Option<String>,
    pub target_balance: Decimal,
    pub effective_time: NaiveDateTime,
    pub reason: String,
    pub created_by: Option<i64>,
    pub created_by_name: Option<String>,
    pub created_at: NaiveDateTime,
}

impl From<BalanceCalibrationRecordRow> for BalanceCalibrationRecord {
    fn from(row: BalanceCalibrationRecordRow) -> Self {
        Self {
            id: row.id,
            user_id: row.user_id,
            user_name: row.user_name,
            target_balance: row.target_balance,
            effective_time: row.effective_time,
            reason: row.reason,
            created_by: row.created_by,
            created_by_name: row.created_by_name,
            created_at: row.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct ActivityBillingSummaryRow {
    pub month_key: String,
    pub activity_id: String,
    pub activity_name: String,
    pub holding_date: NaiveDateTime,
    pub location: String,
    pub total: Option<i32>,
    pub fee: Option<Decimal>,
    pub user_id: Option<i64>,
    pub stand: Option<i16>,
    pub registration_count: Option<i32>,
}

#[derive(Debug, FromRow)]
struct ActivitySettlementSummaryRow {
    pub activity_id: String,
    pub description: Option<String>,
    pub total_amount: Option<Decimal>,
    pub aa_fee: Option<Decimal>,
    pub attending_user_count: i32,
    pub settled_user_count: i32,
    pub settled: bool,
    pub settled_at: Option<NaiveDateTime>,
    pub current_batch_no: Option<i32>,
}

impl From<ActivitySettlementSummaryRow> for ActivitySettlementSummary {
    fn from(row: ActivitySettlementSummaryRow) -> Self {
        Self {
            activity_id: row.activity_id,
            description: row.description,
            total_amount: row.total_amount,
            aa_fee: row.aa_fee,
            attending_user_count: row.attending_user_count,
            settled_user_count: row.settled_user_count,
            settled: row.settled,
            settled_at: row.settled_at,
            current_batch_no: row.current_batch_no,
            history: Vec::new(),
        }
    }
}

#[derive(Debug, FromRow)]
struct ActivitySettlementBatchRow {
    pub batch_no: i32,
    pub operation_type: String,
    pub reversal_of_batch_no: Option<i32>,
    pub description: String,
    pub total_amount: Decimal,
    pub aa_fee: Decimal,
    pub user_count: i32,
    pub created_by_admin_id: Option<i64>,
    pub created_at: NaiveDateTime,
}

impl From<ActivitySettlementBatchRow> for ActivitySettlementBatch {
    fn from(row: ActivitySettlementBatchRow) -> Self {
        Self {
            batch_no: row.batch_no,
            operation_type: row.operation_type,
            reversal_of_batch_no: row.reversal_of_batch_no,
            description: row.description,
            total_amount: row.total_amount,
            aa_fee: row.aa_fee,
            user_count: row.user_count,
            created_by_admin_id: row.created_by_admin_id,
            created_at: row.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
struct ActiveSettlementBatchRow {
    pub id: i64,
    pub batch_no: i32,
    pub total_amount: Decimal,
    pub aa_fee: Decimal,
    pub user_count: i32,
}

impl From<ActivityBillingSummaryRow> for ActivityBillingSummary {
    fn from(row: ActivityBillingSummaryRow) -> Self {
        Self {
            month_key: row.month_key,
            activity_id: row.activity_id,
            activity_name: row.activity_name,
            holding_date: row.holding_date,
            location: row.location,
            total: row.total,
            fee: row.fee,
            user_id: row.user_id,
            stand: row.stand.map(|s| s as i8),
            registration_count: row.registration_count,
        }
    }
}

// ---------- Repository 实现 ----------

#[derive(Clone)]
pub struct PostgresBillingRepository {
    pool: PgPool,
}

struct SettlementBatchInsert<'a> {
    activity_id: &'a str,
    batch_no: i32,
    operation_type: &'a str,
    reversal_of_batch_id: Option<i64>,
    description: String,
    total_amount: Decimal,
    aa_fee: Decimal,
    user_count: i32,
    created_by_admin_id: Option<i64>,
}

impl PostgresBillingRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn ensure_user_account<'a>(
        executor: impl sqlx::Executor<'a, Database = sqlx::Postgres>,
        user_id: i64,
    ) -> Result<(), DomainError> {
        sqlx::query(
            r#"INSERT INTO rs_user_accounts (user_id, balance, total_recharge, total_expense, total_penalty, version, status, created_at, updated_at)
               VALUES ($1, 0, 0, 0, 0, 1, 1, NOW(), NOW())
               ON CONFLICT (user_id) DO NOTHING"#,
        )
        .bind(user_id)
        .execute(executor)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn fetch_activity_settlement_summary(
        pool: &PgPool,
        activity_id: &str,
    ) -> Result<ActivitySettlementSummary, DomainError> {
        let row = sqlx::query_as::<_, ActivitySettlementSummaryRow>(
            r#"
            WITH active_batch AS (
                SELECT b.id, b.batch_no, b.description, b.total_amount, b.aa_fee, b.user_count, b.created_at
                FROM rs_activity_settlement_batches b
                LEFT JOIN rs_activity_settlement_batches reversed
                    ON reversed.reversal_of_batch_id = b.id
                   AND reversed.operation_type = 'reverse'
                WHERE b.activity_id = $1
                  AND b.operation_type = 'settle'
                  AND reversed.id IS NULL
                ORDER BY b.batch_no DESC
                LIMIT 1
            ),
            attending AS (
                SELECT COUNT(*)::INT AS attending_user_count
                FROM rs_user_activity
                WHERE activity_id = $1 AND stand = 1
            )
            SELECT
                $1::CHAR(36) AS activity_id,
                active_batch.description,
                active_batch.total_amount,
                active_batch.aa_fee,
                COALESCE(attending.attending_user_count, 0) AS attending_user_count,
                COALESCE(active_batch.user_count, 0) AS settled_user_count,
                active_batch.id IS NOT NULL AS settled,
                active_batch.created_at AS settled_at,
                active_batch.batch_no AS current_batch_no
            FROM (SELECT 1) seed
            LEFT JOIN active_batch ON TRUE
            CROSS JOIN attending
            "#,
        )
        .bind(activity_id)
        .fetch_one(pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let history_rows = sqlx::query_as::<_, ActivitySettlementBatchRow>(
            r#"
                SELECT
                b.batch_no,
                b.operation_type,
                source.batch_no AS reversal_of_batch_no,
                b.description,
                b.total_amount,
                b.aa_fee,
                b.user_count,
                b.created_by_admin_id,
                b.created_at
            FROM rs_activity_settlement_batches b
            LEFT JOIN rs_activity_settlement_batches source ON source.id = b.reversal_of_batch_id
            WHERE b.activity_id = $1
            ORDER BY b.batch_no DESC
            "#,
        )
        .bind(activity_id)
        .fetch_all(pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let mut summary = ActivitySettlementSummary::from(row);
        summary.history = history_rows
            .into_iter()
            .map(ActivitySettlementBatch::from)
            .collect();
        Ok(summary)
    }

    async fn get_active_settlement_batch<'a>(
        executor: impl sqlx::Executor<'a, Database = sqlx::Postgres>,
        activity_id: &str,
    ) -> Result<Option<ActiveSettlementBatchRow>, DomainError> {
        sqlx::query_as::<_, ActiveSettlementBatchRow>(
            r#"
            SELECT b.id, b.batch_no, b.total_amount, b.aa_fee, b.user_count
            FROM rs_activity_settlement_batches b
            LEFT JOIN rs_activity_settlement_batches reversed
                ON reversed.reversal_of_batch_id = b.id
               AND reversed.operation_type = 'reverse'
            WHERE b.activity_id = $1
              AND b.operation_type = 'settle'
              AND reversed.id IS NULL
            ORDER BY b.batch_no DESC
            LIMIT 1
            "#,
        )
        .bind(activity_id)
        .fetch_optional(executor)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))
    }

    async fn next_batch_no<'a>(
        executor: impl sqlx::Executor<'a, Database = sqlx::Postgres>,
        activity_id: &str,
    ) -> Result<i32, DomainError> {
        let current = sqlx::query_scalar::<_, Option<i32>>(
            "SELECT MAX(batch_no) FROM rs_activity_settlement_batches WHERE activity_id = $1",
        )
        .bind(activity_id)
        .fetch_one(executor)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(current.unwrap_or(0) + 1)
    }

    async fn create_settlement_batch<'a>(
        executor: impl sqlx::Executor<'a, Database = sqlx::Postgres>,
        batch: SettlementBatchInsert<'_>,
    ) -> Result<i64, DomainError> {
        sqlx::query_scalar::<_, i64>(
            r#"
            INSERT INTO rs_activity_settlement_batches (
                activity_id,
                batch_no,
                operation_type,
                reversal_of_batch_id,
                description,
                total_amount,
                aa_fee,
                user_count,
                created_by_admin_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
            "#,
        )
        .bind(batch.activity_id)
        .bind(batch.batch_no)
        .bind(batch.operation_type)
        .bind(batch.reversal_of_batch_id)
        .bind(batch.description)
        .bind(batch.total_amount)
        .bind(batch.aa_fee)
        .bind(batch.user_count)
        .bind(batch.created_by_admin_id)
        .fetch_one(executor)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))
    }
}

#[async_trait]
impl BillingRepository for PostgresBillingRepository {
    async fn get_user_account(&self, user_id: i64) -> Result<Option<UserAccount>, DomainError> {
        let row = sqlx::query_as::<_, UserAccountRow>(
            r#"SELECT id, user_id, balance, total_recharge, total_expense, total_penalty,
                      last_updated, version, status, created_at, updated_at
               FROM rs_user_accounts WHERE user_id = $1"#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(UserAccount::from))
    }

    async fn create_activity_order(
        &self,
        activity_id: &str,
        description: &str,
        fee: Decimal,
        total: i32,
    ) -> Result<ActivityOrder, DomainError> {
        sqlx::query(
            r#"INSERT INTO rs_activity_order (activity_id, description, fee, total, activity_holding_time, create_time, updated_at)
               VALUES ($1, $2, $3, $4, NULL, NOW(), NOW())
               ON CONFLICT (activity_id) DO UPDATE SET
                   description = EXCLUDED.description,
                   fee = EXCLUDED.fee,
                   total = EXCLUDED.total,
                   updated_at = NOW()"#,
        )
        .bind(activity_id).bind(description).bind(fee).bind(total)
        .execute(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let row = sqlx::query_as::<_, ActivityOrderRow>(
            "SELECT id, activity_id, description, fee, total, activity_holding_time, create_time, updated_at FROM rs_activity_order WHERE activity_id = $1",
        )
        .bind(activity_id)
        .fetch_one(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(ActivityOrder::from(row))
    }

    async fn get_activity_order(
        &self,
        activity_id: &str,
    ) -> Result<Option<ActivityOrder>, DomainError> {
        let row = sqlx::query_as::<_, ActivityOrderRow>(
            "SELECT id, activity_id, description, fee, total, activity_holding_time, create_time, updated_at FROM rs_activity_order WHERE activity_id = $1",
        )
        .bind(activity_id)
        .fetch_optional(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(row.map(ActivityOrder::from))
    }

    async fn list_activity_orders(&self) -> Result<Vec<ActivityOrder>, DomainError> {
        let rows = sqlx::query_as::<_, ActivityOrderRow>(
            "SELECT id, activity_id, description, fee, total, activity_holding_time, create_time, updated_at FROM rs_activity_order ORDER BY create_time DESC",
        )
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(ActivityOrder::from).collect())
    }

    async fn get_activity_settlement_summary(
        &self,
        activity_id: &str,
    ) -> Result<ActivitySettlementSummary, DomainError> {
        Self::fetch_activity_settlement_summary(&self.pool, activity_id).await
    }

    async fn settle_activity_expense(
        &self,
        activity_id: &str,
        total_amount: Decimal,
        description: Option<&str>,
        created_by_admin_id: Option<i64>,
    ) -> Result<ActivitySettlementSummary, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let activity_status =
            sqlx::query_scalar::<_, i16>("SELECT status FROM rs_activity WHERE id = $1")
                .bind(activity_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?
                .ok_or_else(|| DomainError::Validation("活动不存在".to_string()))?;

        if activity_status != 2 {
            return Err(DomainError::Validation("仅已结束比赛可结算".to_string()));
        }

        let user_ids = sqlx::query_scalar::<_, i64>(
            "SELECT user_id FROM rs_user_activity WHERE activity_id = $1 AND stand = 1 ORDER BY user_id",
        )
        .bind(activity_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        if user_ids.is_empty() {
            return Err(DomainError::Validation(
                "当前没有可结算的参赛球员".to_string(),
            ));
        }

        let user_count = user_ids.len() as i32;
        let aa_fee = (total_amount / Decimal::from(user_count)).round_dp(2);
        let order_description = description.unwrap_or("赛后 AA 扣费");
        let mut next_batch_no = Self::next_batch_no(&mut *tx, activity_id).await?;

        if let Some(active_batch) = Self::get_active_settlement_batch(&mut *tx, activity_id).await?
        {
            let reverse_batch_id = Self::create_settlement_batch(
                &mut *tx,
                SettlementBatchInsert {
                    activity_id,
                    batch_no: next_batch_no,
                    operation_type: "reverse",
                    reversal_of_batch_id: Some(active_batch.id),
                    description: format!("冲正第{}批结算", active_batch.batch_no),
                    total_amount: -active_batch.total_amount,
                    aa_fee: -active_batch.aa_fee,
                    user_count: active_batch.user_count,
                    created_by_admin_id,
                },
            )
            .await?;
            next_batch_no += 1;

            let prior_billings = sqlx::query_as::<_, (i64, Decimal)>(
                r#"
                SELECT user_id, fee
                FROM rs_user_billings
                WHERE settlement_batch_id = $1
                ORDER BY id ASC
                "#,
            )
            .bind(active_batch.id)
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

            for (user_id, previous_fee) in prior_billings {
                let reverse_fee = -previous_fee;
                sqlx::query_scalar::<_, i64>(
                    r#"
                    INSERT INTO rs_user_billings (
                        user_id, game_id, fee, billing_type, description, billing_date, settlement_batch_id, status, created_at, updated_at
                    ) VALUES ($1, $2, $3, 'game_fee_reversal', $4, $5, $6, 1, NOW(), NOW())
                    RETURNING id
                    "#,
                )
                .bind(user_id)
                .bind(activity_id)
                .bind(reverse_fee)
                .bind(format!("冲正第{}批结算", active_batch.batch_no))
                .bind(Utc::now().date_naive())
                .bind(reverse_batch_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

                sqlx::query(
                    "UPDATE rs_user_accounts SET balance = balance - $1, total_expense = total_expense + $2, last_updated = NOW(), updated_at = NOW() WHERE user_id = $3",
                )
                .bind(reverse_fee)
                .bind(reverse_fee)
                .bind(user_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
            }
        }

        let settle_batch_id = Self::create_settlement_batch(
            &mut *tx,
            SettlementBatchInsert {
                activity_id,
                batch_no: next_batch_no,
                operation_type: "settle",
                reversal_of_batch_id: None,
                description: order_description.to_string(),
                total_amount,
                aa_fee,
                user_count,
                created_by_admin_id,
            },
        )
        .await?;

        sqlx::query(
            r#"INSERT INTO rs_activity_order (activity_id, description, fee, total, activity_holding_time, create_time, updated_at)
               VALUES ($1, $2, $3, $4, NULL, NOW(), NOW())
               ON CONFLICT (activity_id) DO UPDATE SET
                   description = EXCLUDED.description,
                   fee = EXCLUDED.fee,
                   total = EXCLUDED.total,
                   updated_at = NOW()"#,
        )
        .bind(activity_id)
        .bind(order_description)
        .bind(aa_fee)
        .bind(user_count)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let billing_date = Utc::now().date_naive();
        for user_id in user_ids {
            Self::ensure_user_account(&mut *tx, user_id).await?;

            sqlx::query_scalar::<_, i64>(
                "INSERT INTO rs_user_billings (user_id, game_id, fee, billing_type, description, billing_date, settlement_batch_id, status, created_at, updated_at) VALUES ($1, $2, $3, 'game_fee', $4, $5, $6, 1, NOW(), NOW()) RETURNING id",
            )
            .bind(user_id)
            .bind(activity_id)
            .bind(aa_fee)
            .bind(Some(order_description))
            .bind(billing_date)
            .bind(settle_batch_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

            sqlx::query(
                "UPDATE rs_user_accounts SET balance = balance - $1, total_expense = total_expense + $2, last_updated = NOW(), updated_at = NOW() WHERE user_id = $3",
            )
            .bind(aa_fee)
            .bind(aa_fee)
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }

        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Self::fetch_activity_settlement_summary(&self.pool, activity_id).await
    }

    async fn list_user_billings(
        &self,
        user_id: i64,
    ) -> Result<Vec<UserBillingRecord>, DomainError> {
        let rows = sqlx::query_as::<_, UserBillingRecordRow>(
            "SELECT id, user_id, game_id, fee, billing_type, description, billing_date, status, created_at, updated_at FROM rs_user_billings WHERE user_id = $1 ORDER BY billing_date DESC, id DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(UserBillingRecord::from).collect())
    }

    async fn recharge(
        &self,
        user_id: i64,
        amount: Decimal,
        payment_method: &str,
        transaction_no: Option<&str>,
        description: Option<&str>,
    ) -> Result<i64, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Self::ensure_user_account(&mut *tx, user_id).await?;

        let id: i64 = sqlx::query_scalar(
            r#"INSERT INTO rs_recharge_records (user_id, amount, payment_method, transaction_no, recharge_date, description, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, 1, NOW(), NOW())
               RETURNING id"#,
        )
        .bind(user_id).bind(amount).bind(payment_method).bind(transaction_no).bind(description)
        .fetch_one(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            "UPDATE rs_user_accounts SET balance = balance + $1, total_recharge = total_recharge + $2, last_updated = NOW(), updated_at = NOW() WHERE user_id = $3",
        )
        .bind(amount).bind(amount).bind(user_id)
        .execute(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(id)
    }

    async fn add_game_expenses(
        &self,
        activity_id: &str,
        user_ids: &[i64],
        fee: Decimal,
        description: Option<&str>,
    ) -> Result<Vec<i64>, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        let billing_date = Utc::now().date_naive();
        let mut ids = Vec::with_capacity(user_ids.len());

        for user_id in user_ids {
            Self::ensure_user_account(&mut *tx, *user_id).await?;
            let id: i64 = sqlx::query_scalar(
                "INSERT INTO rs_user_billings (user_id, game_id, fee, billing_type, description, billing_date, status, created_at, updated_at) VALUES ($1, $2, $3, 'game_fee', $4, $5, 1, NOW(), NOW()) RETURNING id",
            )
            .bind(*user_id).bind(activity_id).bind(fee).bind(description).bind(billing_date)
            .fetch_one(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
            ids.push(id);

            sqlx::query(
                "UPDATE rs_user_accounts SET balance = balance - $1, total_expense = total_expense + $2, last_updated = NOW(), updated_at = NOW() WHERE user_id = $3",
            )
            .bind(fee).bind(fee).bind(*user_id)
            .execute(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }

        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(ids)
    }

    async fn add_penalty(
        &self,
        user_id: i64,
        month_key: &str,
        amount: Decimal,
        reason: &str,
        created_by: Option<i64>,
    ) -> Result<(i64, Option<i64>), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Self::ensure_user_account(&mut *tx, user_id).await?;

        let penalty_date = Utc::now().date_naive();
        let penalty_id: i64 = sqlx::query_scalar(
            "INSERT INTO rs_monthly_penalties (user_id, month_key, fee, reason, penalty_date, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW()) RETURNING id",
        )
        .bind(user_id).bind(month_key).bind(amount).bind(reason).bind(penalty_date)
        .fetch_one(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            "UPDATE rs_user_accounts SET balance = balance - $1, total_penalty = total_penalty + $2, last_updated = NOW(), updated_at = NOW() WHERE user_id = $3",
        )
        .bind(amount).bind(amount).bind(user_id)
        .execute(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let current_balance: Decimal =
            sqlx::query_scalar("SELECT balance FROM rs_team_fund_account WHERE id = 1")
                .fetch_one(&mut *tx)
                .await
                .unwrap_or(Decimal::ZERO);
        let new_balance = current_balance + amount;
        sqlx::query(
            "UPDATE rs_team_fund_account SET balance = $1, total_income = total_income + $2, last_updated = NOW(), updated_at = NOW() WHERE id = 1",
        )
        .bind(new_balance).bind(amount)
        .execute(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let fund_id: i64 = sqlx::query_scalar(
            "INSERT INTO rs_team_fund_transactions (transaction_type, amount, source_type, source_id, description, transaction_date, balance_after, created_by, status, created_at, updated_at) VALUES ('penalty', $1, 'monthly_penalty', $2, $3, CURRENT_DATE, $4, $5, 1, NOW(), NOW()) RETURNING id",
        )
        .bind(amount).bind(penalty_id).bind(reason).bind(new_balance).bind(created_by)
        .fetch_one(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok((penalty_id, Some(fund_id)))
    }

    async fn calibrate_balance(
        &self,
        user_id: i64,
        target_balance: Decimal,
        effective_time: chrono::NaiveDateTime,
        reason: &str,
        created_by: Option<i64>,
    ) -> Result<(i64, Decimal), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Self::ensure_user_account(&mut *tx, user_id).await?;

        let id: i64 = sqlx::query_scalar(
            "INSERT INTO rs_user_balance_adjustments (user_id, target_balance, effective_time, reason, created_by, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW()) RETURNING id",
        )
        .bind(user_id).bind(target_balance).bind(effective_time).bind(reason).bind(created_by)
        .fetch_one(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            "UPDATE rs_user_accounts SET balance = $1, last_updated = NOW(), updated_at = NOW() WHERE user_id = $2",
        )
        .bind(target_balance).bind(user_id)
        .execute(&mut *tx).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok((id, target_balance))
    }

    async fn list_balance_calibrations(
        &self,
    ) -> Result<Vec<BalanceCalibrationRecord>, DomainError> {
        let rows = sqlx::query_as::<_, BalanceCalibrationRecordRow>(
            r#"SELECT uba.id, uba.user_id,
                      COALESCE(NULLIF(u.real_name, ''), NULLIF(u.nickname, ''), u.username) AS user_name,
                      uba.target_balance, uba.effective_time, uba.reason, uba.created_by,
                      a.nickname AS created_by_name, uba.created_at
               FROM rs_user_balance_adjustments uba
               INNER JOIN rs_user_info u ON u.id = uba.user_id
               LEFT JOIN rs_admin_user a ON a.id = uba.created_by
               ORDER BY uba.effective_time DESC, uba.created_at DESC"#,
        )
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows
            .into_iter()
            .map(BalanceCalibrationRecord::from)
            .collect())
    }

    async fn list_transactions(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<TransactionRecord>, DomainError> {
        let normalized_limit = limit.clamp(1, 200);

        let recharge_rows = sqlx::query(
            "SELECT id, user_id, amount, description, created_at FROM rs_recharge_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        )
        .bind(user_id).bind(normalized_limit)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let expense_rows = sqlx::query(
            "SELECT id, user_id, fee, description, game_id, created_at FROM rs_user_billings WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        )
        .bind(user_id).bind(normalized_limit)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let penalty_rows = sqlx::query(
            "SELECT id, user_id, fee, reason, created_at FROM rs_monthly_penalties WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        )
        .bind(user_id).bind(normalized_limit)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let mut result = Vec::new();
        for row in recharge_rows {
            result.push(TransactionRecord {
                id: row.get("id"),
                user_id: row.get("user_id"),
                record_type: "recharge".to_string(),
                amount: row.get("amount"),
                description: row.get("description"),
                activity_id: None,
                created_at: row.get("created_at"),
            });
        }
        for row in expense_rows {
            let amount: Decimal = row.get("fee");
            result.push(TransactionRecord {
                id: row.get("id"),
                user_id: row.get("user_id"),
                record_type: "expense".to_string(),
                amount: -amount,
                description: row.get("description"),
                activity_id: row.get("game_id"),
                created_at: row.get("created_at"),
            });
        }
        for row in penalty_rows {
            let amount: Decimal = row.get("fee");
            result.push(TransactionRecord {
                id: row.get("id"),
                user_id: row.get("user_id"),
                record_type: "penalty".to_string(),
                amount: -amount,
                description: row.get("reason"),
                activity_id: None,
                created_at: row.get("created_at"),
            });
        }

        result.sort_by(|l, r| r.created_at.cmp(&l.created_at));
        result.truncate(normalized_limit as usize);
        Ok(result)
    }

    async fn list_activities_billing(&self) -> Result<Vec<ActivityBillingSummary>, DomainError> {
        let rows = sqlx::query_as::<_, ActivityBillingSummaryRow>(
            r#"SELECT TO_CHAR(a.holding_date, 'YYYY-MM') AS month_key,
                      a.id AS activity_id, a.name AS activity_name, a.holding_date, a.location,
                      ao.total, ao.fee, ua.user_id, ua.stand, ua.registration_count
               FROM rs_activity a
               LEFT JOIN rs_activity_order ao ON ao.activity_id = a.id
               LEFT JOIN rs_user_activity ua ON ua.activity_id = a.id
               ORDER BY a.holding_date DESC, a.id DESC, ua.user_id ASC"#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(ActivityBillingSummary::from).collect())
    }

    async fn list_users_billing(&self) -> Result<Vec<UserAccount>, DomainError> {
        let rows = sqlx::query_as::<_, UserAccountRow>(
            "SELECT id, user_id, balance, total_recharge, total_expense, total_penalty, last_updated, version, status, created_at, updated_at FROM rs_user_accounts ORDER BY user_id ASC",
        )
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(rows.into_iter().map(UserAccount::from).collect())
    }

    async fn get_user_billing_flow(&self, user_id: i64) -> Result<BillingFlowResult, DomainError> {
        let account = self.get_user_account(user_id).await?;
        let transactions = self.list_transactions(user_id, 500).await?;
        let calibration_rows = sqlx::query_as::<_, BalanceCalibrationRecordRow>(
            r#"SELECT uba.id, uba.user_id,
                      COALESCE(NULLIF(u.real_name, ''), NULLIF(u.nickname, ''), u.username) AS user_name,
                      uba.target_balance, uba.effective_time, uba.reason, uba.created_by,
                      a.nickname AS created_by_name, uba.created_at
               FROM rs_user_balance_adjustments uba
               INNER JOIN rs_user_info u ON u.id = uba.user_id
               LEFT JOIN rs_admin_user a ON a.id = uba.created_by
               WHERE uba.user_id = $1
               ORDER BY uba.effective_time ASC, uba.created_at ASC"#,
        )
        .bind(user_id)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        let calibrations: Vec<BalanceCalibrationRecord> = calibration_rows
            .into_iter()
            .map(BalanceCalibrationRecord::from)
            .collect();

        #[derive(Clone)]
        struct PendingRecord {
            id: String,
            record_type: String,
            type_name: String,
            amount: Decimal,
            description: String,
            activity_id: Option<String>,
            created_at: NaiveDateTime,
            is_calibration: bool,
        }

        let mut pending = Vec::new();
        for calibration in calibrations {
            pending.push(PendingRecord {
                id: format!("calibration_{}", calibration.id),
                record_type: "calibration".to_string(),
                type_name: "余额校准".to_string(),
                amount: calibration.target_balance,
                description: calibration.reason,
                activity_id: None,
                created_at: calibration.created_at,
                is_calibration: true,
            });
        }
        for tx in transactions {
            let type_name = match tx.record_type.as_str() {
                "recharge" => "充值",
                "expense" => "比赛扣费",
                "penalty" => "月度罚款",
                _ => "账单记录",
            };
            pending.push(PendingRecord {
                id: format!("{}_{}", tx.record_type, tx.id),
                record_type: tx.record_type,
                type_name: type_name.to_string(),
                amount: tx.amount,
                description: tx.description.unwrap_or_default(),
                activity_id: tx.activity_id,
                created_at: tx.created_at,
                is_calibration: false,
            });
        }

        pending.sort_by(|l, r| l.created_at.cmp(&r.created_at));
        let mut balance = Decimal::ZERO;
        let mut records = Vec::with_capacity(pending.len());
        for item in pending {
            if item.is_calibration {
                balance = item.amount;
            } else {
                balance += item.amount;
            }
            records.push(BillingFlowRecord {
                id: item.id,
                record_type: item.record_type,
                type_name: item.type_name,
                amount: item.amount,
                description: item.description,
                activity_id: item.activity_id,
                created_at: item.created_at,
                balance,
            });
        }
        records.reverse();

        Ok(BillingFlowResult {
            final_balance: account.map(|a| a.balance).unwrap_or(balance),
            records,
        })
    }

    async fn calculate_monthly_penalty_candidates(
        &self,
        month_key: &str,
    ) -> Result<Vec<PenaltyCandidate>, DomainError> {
        let activities = sqlx::query(
            "SELECT id, holding_date FROM rs_activity WHERE TO_CHAR(holding_date, 'YYYY-MM') = $1 ORDER BY holding_date ASC",
        )
        .bind(month_key)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        if activities.len() < 4 {
            return Ok(Vec::new());
        }

        let users = sqlx::query(
            "SELECT id, leave_start_time, leave_end_time FROM rs_user_info WHERE status = 1",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let registrations = sqlx::query(
            "SELECT activity_id, user_id, stand FROM rs_user_activity WHERE activity_id IN (SELECT id FROM rs_activity WHERE TO_CHAR(holding_date, 'YYYY-MM') = $1)",
        )
        .bind(month_key)
        .fetch_all(&self.pool).await.map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        use std::collections::HashMap;
        let mut registration_map: HashMap<(String, i64), i16> = HashMap::new();
        for row in registrations {
            registration_map.insert(
                (row.get("activity_id"), row.get("user_id")),
                row.get("stand"),
            );
        }

        let mut result = Vec::new();
        for user in users {
            let user_id: i64 = user.get("id");
            let leave_start: Option<NaiveDateTime> = user.get("leave_start_time");
            let leave_end: Option<NaiveDateTime> = user.get("leave_end_time");

            let mut applicable = 0;
            let mut attended = 0;
            for activity in &activities {
                let activity_id: String = activity.get("id");
                let holding_date: NaiveDateTime = activity.get("holding_date");
                let on_leave = match (leave_start, leave_end) {
                    (Some(start), Some(end)) => holding_date >= start && holding_date <= end,
                    _ => false,
                };
                if on_leave {
                    continue;
                }
                applicable += 1;
                if registration_map
                    .get(&(activity_id, user_id))
                    .copied()
                    .unwrap_or_default()
                    == 1
                {
                    attended += 1;
                }
            }

            if applicable < 4 {
                continue;
            }

            let amount = if attended == 0 {
                Decimal::from(100)
            } else if attended == 1 {
                Decimal::from(50)
            } else {
                Decimal::ZERO
            };

            if amount > Decimal::ZERO {
                result.push(PenaltyCandidate {
                    user_id,
                    amount,
                    reason: format!("{month_key} 月罚款（参加 {attended} 场，共 {applicable} 场）"),
                });
            }
        }

        Ok(result)
    }
}
