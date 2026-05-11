use crate::activity::domain::Activity;
use crate::challenge::domain::{
    Challenge, ChallengeDetail, ChallengeKind, ChallengeStatus, ChallengeSummary, DomainError,
};
use crate::challenge::ports::{
    AdminChallengeRepositoryQuery, ChallengeRepository, TeamChallengeListQuery,
};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use rust_decimal::Decimal;
use sqlx::{FromRow, PgPool, Postgres, QueryBuilder};

#[derive(Clone)]
pub struct PostgresChallengeRepository {
    pool: PgPool,
}

#[derive(Debug, FromRow)]
struct ChallengeRow {
    id: String,
    title: String,
    kind: String,
    host_team_id: String,
    host_user_id: i64,
    guest_team_id: Option<String>,
    accepted_by_user_id: Option<i64>,
    activity_id: Option<String>,
    holding_date: NaiveDateTime,
    start_time: NaiveDateTime,
    end_time: NaiveDateTime,
    location: String,
    location_latitude: Option<f64>,
    location_longitude: Option<f64>,
    players_per_team: i32,
    fee_per_person: Option<Decimal>,
    note: Option<String>,
    status: String,
    accepted_at: Option<NaiveDateTime>,
    cancelled_at: Option<NaiveDateTime>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

#[derive(Debug, FromRow)]
struct ChallengeSummaryRow {
    id: String,
    title: String,
    kind: String,
    host_team_id: String,
    host_user_id: i64,
    guest_team_id: Option<String>,
    accepted_by_user_id: Option<i64>,
    activity_id: Option<String>,
    holding_date: NaiveDateTime,
    start_time: NaiveDateTime,
    end_time: NaiveDateTime,
    location: String,
    location_latitude: Option<f64>,
    location_longitude: Option<f64>,
    players_per_team: i32,
    fee_per_person: Option<Decimal>,
    note: Option<String>,
    status: String,
    accepted_at: Option<NaiveDateTime>,
    cancelled_at: Option<NaiveDateTime>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    host_team_name: String,
    host_team_credit_score: i32,
    host_team_trust_label: String,
    guest_team_name: Option<String>,
    guest_team_credit_score: Option<i32>,
    guest_team_trust_label: Option<String>,
    current_team_relation: Option<String>,
    accepted_count: i32,
    current_user_joined: bool,
    can_accept: bool,
}

#[derive(Debug, FromRow)]
struct ActivityRow {
    id: String,
    cover: Option<String>,
    start_time: NaiveDateTime,
    end_time: NaiveDateTime,
    holding_date: NaiveDateTime,
    location: String,
    location_latitude: Option<f64>,
    location_longitude: Option<f64>,
    name: String,
    opposing: Option<String>,
    status: i16,
    description: Option<String>,
    home_team_id: Option<String>,
    away_team_id: Option<String>,
    color: Option<String>,
    opposing_color: Option<String>,
    players_per_team: Option<i32>,
    match_kind: Option<String>,
    source_activity_id: Option<String>,
    team_registration_count: Option<i32>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
}

impl From<ChallengeRow> for Challenge {
    fn from(row: ChallengeRow) -> Self {
        Self {
            id: row.id,
            title: row.title,
            kind: ChallengeKind::from_db_str(&row.kind),
            host_team_id: row.host_team_id,
            host_user_id: row.host_user_id,
            guest_team_id: row.guest_team_id,
            accepted_by_user_id: row.accepted_by_user_id,
            activity_id: row.activity_id,
            holding_date: row.holding_date,
            start_time: row.start_time,
            end_time: row.end_time,
            location: row.location,
            location_latitude: row.location_latitude,
            location_longitude: row.location_longitude,
            players_per_team: row.players_per_team,
            fee_per_person: row.fee_per_person,
            note: row.note,
            status: ChallengeStatus::from_db_str(&row.status),
            accepted_at: row.accepted_at,
            cancelled_at: row.cancelled_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

impl From<ActivityRow> for Activity {
    fn from(row: ActivityRow) -> Self {
        Self {
            id: row.id,
            cover: row.cover,
            start_time: row.start_time,
            end_time: row.end_time,
            holding_date: row.holding_date,
            location: row.location,
            location_latitude: row.location_latitude,
            location_longitude: row.location_longitude,
            name: row.name,
            opposing: row.opposing,
            status: row.status as i8,
            description: row.description,
            home_team_id: row.home_team_id,
            away_team_id: row.away_team_id,
            color: row.color,
            opposing_color: row.opposing_color,
            players_per_team: row.players_per_team,
            match_kind: row.match_kind,
            source_activity_id: row.source_activity_id,
            team_registration_count: row.team_registration_count,
            team_checkin_configs: vec![],
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

impl From<ChallengeSummaryRow> for ChallengeSummary {
    fn from(row: ChallengeSummaryRow) -> Self {
        Self {
            challenge: Challenge {
                id: row.id,
                title: row.title,
                kind: ChallengeKind::from_db_str(&row.kind),
                host_team_id: row.host_team_id,
                host_user_id: row.host_user_id,
                guest_team_id: row.guest_team_id,
                accepted_by_user_id: row.accepted_by_user_id,
                activity_id: row.activity_id,
                holding_date: row.holding_date,
                start_time: row.start_time,
                end_time: row.end_time,
                location: row.location,
                location_latitude: row.location_latitude,
                location_longitude: row.location_longitude,
                players_per_team: row.players_per_team,
                fee_per_person: row.fee_per_person,
                note: row.note,
                status: ChallengeStatus::from_db_str(&row.status),
                accepted_at: row.accepted_at,
                cancelled_at: row.cancelled_at,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            host_team_name: row.host_team_name,
            host_team_credit_score: row.host_team_credit_score,
            host_team_trust_label: row.host_team_trust_label,
            guest_team_name: row.guest_team_name,
            guest_team_credit_score: row.guest_team_credit_score,
            guest_team_trust_label: row.guest_team_trust_label,
            current_team_relation: row.current_team_relation,
            accepted_count: row.accepted_count,
            current_user_joined: row.current_user_joined,
            can_accept: row.can_accept,
        }
    }
}

impl PostgresChallengeRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn fetch_summary(
        &self,
        challenge_id: &str,
        user_id: Option<i64>,
    ) -> Result<Option<ChallengeSummary>, DomainError> {
        let row = sqlx::query_as::<_, ChallengeSummaryRow>(
            r#"
            SELECT
                c.id,
                c.title,
                c.kind,
                c.host_team_id,
                c.host_user_id,
                c.guest_team_id,
                c.accepted_by_user_id,
                c.activity_id,
                c.holding_date,
                c.start_time,
                c.end_time,
                c.location,
                c.location_latitude,
                c.location_longitude,
                c.players_per_team,
                c.fee_per_person,
                c.note,
                c.status,
                c.accepted_at,
                c.cancelled_at,
                c.created_at,
                c.updated_at,
                host.name AS host_team_name,
                host.credit_score AS host_team_credit_score,
                CASE
                    WHEN host.credit_score >= 90 THEN '金牌信用'
                    WHEN host.credit_score >= 80 THEN '稳定赴约'
                    WHEN host.credit_score >= 70 THEN '评价稳定'
                    WHEN host.credit_score >= 60 THEN '活跃新队'
                    ELSE '风险较高'
                END AS host_team_trust_label,
                guest.name AS guest_team_name,
                guest.credit_score AS guest_team_credit_score,
                CASE
                    WHEN guest.credit_score IS NULL THEN NULL
                    WHEN guest.credit_score >= 90 THEN '金牌信用'
                    WHEN guest.credit_score >= 80 THEN '稳定赴约'
                    WHEN guest.credit_score >= 70 THEN '评价稳定'
                    WHEN guest.credit_score >= 60 THEN '活跃新队'
                    ELSE '风险较高'
                END AS guest_team_trust_label,
                NULL::varchar AS current_team_relation,
                COALESCE((
                    SELECT COUNT(*)::int
                    FROM rs_challenge_individual_acceptances acceptances
                    WHERE acceptances.challenge_id = c.id
                ), 0) AS accepted_count,
                CASE
                    WHEN $2::bigint IS NULL THEN false
                    ELSE EXISTS(
                        SELECT 1
                        FROM rs_challenge_individual_acceptances acceptances
                        WHERE acceptances.challenge_id = c.id AND acceptances.user_id = $2
                    )
                END AS current_user_joined,
                false AS can_accept
            FROM rs_challenges c
            INNER JOIN rs_teams host ON host.id = c.host_team_id
            LEFT JOIN rs_teams guest ON guest.id = c.guest_team_id
            WHERE c.id = $1
            "#,
        )
        .bind(challenge_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(ChallengeSummary::from))
    }
}

#[async_trait]
impl ChallengeRepository for PostgresChallengeRepository {
    async fn create(&self, challenge: &Challenge) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO rs_challenges (
                id, title, kind, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $22
            )
            "#,
        )
        .bind(&challenge.id)
        .bind(&challenge.title)
        .bind(challenge.kind.as_db_str())
        .bind(&challenge.host_team_id)
        .bind(challenge.host_user_id)
        .bind(&challenge.guest_team_id)
        .bind(challenge.accepted_by_user_id)
        .bind(&challenge.activity_id)
        .bind(challenge.holding_date)
        .bind(challenge.start_time)
        .bind(challenge.end_time)
        .bind(&challenge.location)
        .bind(challenge.location_latitude)
        .bind(challenge.location_longitude)
        .bind(challenge.players_per_team)
        .bind(challenge.fee_per_person)
        .bind(&challenge.note)
        .bind(challenge.status.as_db_str())
        .bind(challenge.accepted_at)
        .bind(challenge.cancelled_at)
        .bind(challenge.created_at)
        .bind(challenge.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, challenge_id: &str) -> Result<Option<Challenge>, DomainError> {
        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            SELECT
                id, title, kind, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            FROM rs_challenges
            WHERE id = $1
            "#,
        )
        .bind(challenge_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(row.map(Challenge::from))
    }

    async fn list_for_team(
        &self,
        query: TeamChallengeListQuery<'_>,
    ) -> Result<Vec<ChallengeSummary>, DomainError> {
        let mut query_builder = QueryBuilder::<Postgres>::new(
            r#"
            SELECT
                c.id,
                c.title,
                c.kind,
                c.host_team_id,
                c.host_user_id,
                c.guest_team_id,
                c.accepted_by_user_id,
                c.activity_id,
                c.holding_date,
                c.start_time,
                c.end_time,
                c.location,
                c.location_latitude,
                c.location_longitude,
                c.players_per_team,
                c.fee_per_person,
                c.note,
                c.status,
                c.accepted_at,
                c.cancelled_at,
                c.created_at,
                c.updated_at,
                host.name AS host_team_name,
                host.credit_score AS host_team_credit_score,
                CASE
                    WHEN host.credit_score >= 90 THEN '金牌信用'
                    WHEN host.credit_score >= 80 THEN '稳定赴约'
                    WHEN host.credit_score >= 70 THEN '评价稳定'
                    WHEN host.credit_score >= 60 THEN '活跃新队'
                    ELSE '风险较高'
                END AS host_team_trust_label,
                guest.name AS guest_team_name,
                guest.credit_score AS guest_team_credit_score,
                CASE
                    WHEN guest.credit_score IS NULL THEN NULL
                    WHEN guest.credit_score >= 90 THEN '金牌信用'
                    WHEN guest.credit_score >= 80 THEN '稳定赴约'
                    WHEN guest.credit_score >= 70 THEN '评价稳定'
                    WHEN guest.credit_score >= 60 THEN '活跃新队'
                    ELSE '风险较高'
                END AS guest_team_trust_label,
                NULL::varchar AS current_team_relation,
                COALESCE((
                    SELECT COUNT(*)::int
                    FROM rs_challenge_individual_acceptances acceptances
                    WHERE acceptances.challenge_id = c.id
                ), 0) AS accepted_count,
                EXISTS(
                    SELECT 1
                    FROM rs_challenge_individual_acceptances acceptances
                    WHERE acceptances.challenge_id = c.id AND acceptances.user_id =
            "#,
        );
        query_builder.push_bind(query.user_id);
        query_builder.push(
            r#"
                ) AS current_user_joined,
                false AS can_accept
            FROM rs_challenges c
            INNER JOIN rs_teams host ON host.id = c.host_team_id
            LEFT JOIN rs_teams guest ON guest.id = c.guest_team_id
            "#,
        );
        query_builder.push(" WHERE (c.status = 'open' OR c.host_team_id = ");
        query_builder.push_bind(query.team_id);
        query_builder.push(" OR c.guest_team_id = ");
        query_builder.push_bind(query.team_id);
        query_builder.push(")");

        if !query.include_closed {
            query_builder.push(" AND c.status <> 'cancelled'");
        }

        if let Some(status) = query.status {
            query_builder
                .push(" AND c.status = ")
                .push_bind(status.as_db_str());
        }

        if let Some(keyword) = query
            .keyword
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| format!("%{value}%"))
        {
            query_builder
                .push(" AND (c.title ILIKE ")
                .push_bind(keyword.clone())
                .push(" OR c.location ILIKE ")
                .push_bind(keyword.clone())
                .push(" OR host.name ILIKE ")
                .push_bind(keyword.clone())
                .push(" OR COALESCE(guest.name, '') ILIKE ")
                .push_bind(keyword)
                .push(")");
        }

        let order_clause = match query.sort {
            "holding_date_desc" => " ORDER BY c.holding_date DESC, c.created_at DESC",
            "created_at_asc" => " ORDER BY c.created_at ASC, c.holding_date ASC",
            "created_at_desc" => " ORDER BY c.created_at DESC, c.holding_date ASC",
            "credit_desc" => {
                " ORDER BY GREATEST(host.credit_score, COALESCE(guest.credit_score, 0)) DESC, c.holding_date ASC"
            }
            _ => " ORDER BY c.holding_date ASC, c.created_at DESC",
        };
        query_builder.push(order_clause);
        query_builder.push(" LIMIT ");
        query_builder.push_bind(query.limit.max(1));

        let rows = query_builder
            .build_query_as::<ChallengeSummaryRow>()
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(ChallengeSummary::from)
            .map(|mut summary| {
                summary.current_team_relation = Some(
                    if summary.challenge.host_team_id == query.team_id {
                        "host"
                    } else if summary.challenge.guest_team_id.as_deref() == Some(query.team_id) {
                        "guest"
                    } else {
                        "viewer"
                    }
                    .to_string(),
                );
                summary.can_accept = summary.challenge.status == ChallengeStatus::Open
                    && summary.challenge.host_team_id != query.team_id;
                summary
            })
            .collect())
    }

    async fn list_for_admin(
        &self,
        query: AdminChallengeRepositoryQuery<'_>,
    ) -> Result<Vec<ChallengeSummary>, DomainError> {
        if query.accessible_team_ids.is_some_and(|ids| ids.is_empty()) {
            return Ok(Vec::new());
        }

        let mut query_builder = QueryBuilder::<Postgres>::new(
            r#"
            SELECT
                c.id,
                c.title,
                c.kind,
                c.host_team_id,
                c.host_user_id,
                c.guest_team_id,
                c.accepted_by_user_id,
                c.activity_id,
                c.holding_date,
                c.start_time,
                c.end_time,
                c.location,
                c.location_latitude,
                c.location_longitude,
                c.players_per_team,
                c.fee_per_person,
                c.note,
                c.status,
                c.accepted_at,
                c.cancelled_at,
                c.created_at,
                c.updated_at,
                host.name AS host_team_name,
                host.credit_score AS host_team_credit_score,
                CASE
                    WHEN host.credit_score >= 90 THEN '金牌信用'
                    WHEN host.credit_score >= 80 THEN '稳定赴约'
                    WHEN host.credit_score >= 70 THEN '评价稳定'
                    WHEN host.credit_score >= 60 THEN '活跃新队'
                    ELSE '风险较高'
                END AS host_team_trust_label,
                guest.name AS guest_team_name,
                guest.credit_score AS guest_team_credit_score,
                CASE
                    WHEN guest.credit_score IS NULL THEN NULL
                    WHEN guest.credit_score >= 90 THEN '金牌信用'
                    WHEN guest.credit_score >= 80 THEN '稳定赴约'
                    WHEN guest.credit_score >= 70 THEN '评价稳定'
                    WHEN guest.credit_score >= 60 THEN '活跃新队'
                    ELSE '风险较高'
                END AS guest_team_trust_label,
                NULL::varchar AS current_team_relation,
                COALESCE((
                    SELECT COUNT(*)::int
                    FROM rs_challenge_individual_acceptances acceptances
                    WHERE acceptances.challenge_id = c.id
                ), 0) AS accepted_count,
                false AS current_user_joined,
                false AS can_accept
            FROM rs_challenges c
            INNER JOIN rs_teams host ON host.id = c.host_team_id
            LEFT JOIN rs_teams guest ON guest.id = c.guest_team_id
            WHERE 1 = 1
            "#,
        );

        if !query.include_closed {
            query_builder.push(" AND c.status <> 'cancelled'");
        }

        if let Some(status) = query.status {
            query_builder
                .push(" AND c.status = ")
                .push_bind(status.as_db_str());
        }

        if let Some(team_id) = query.team_id.filter(|value| !value.trim().is_empty()) {
            query_builder
                .push(" AND (c.host_team_id = ")
                .push_bind(team_id)
                .push(" OR c.guest_team_id = ")
                .push_bind(team_id)
                .push(")");
        }

        if let Some(keyword) = query
            .keyword
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| format!("%{value}%"))
        {
            query_builder
                .push(" AND (c.title ILIKE ")
                .push_bind(keyword.clone())
                .push(" OR c.location ILIKE ")
                .push_bind(keyword.clone())
                .push(" OR host.name ILIKE ")
                .push_bind(keyword.clone())
                .push(" OR COALESCE(guest.name, '') ILIKE ")
                .push_bind(keyword)
                .push(")");
        }

        if let Some(team_ids) = query.accessible_team_ids {
            query_builder.push(" AND (c.host_team_id IN (");
            {
                let mut separated = query_builder.separated(", ");
                for team_id in team_ids {
                    separated.push_bind(team_id);
                }
            }
            query_builder.push(") OR c.guest_team_id IN (");
            {
                let mut separated = query_builder.separated(", ");
                for team_id in team_ids {
                    separated.push_bind(team_id);
                }
            }
            query_builder.push("))");
        }

        let order_clause = match query.sort {
            "holding_date_desc" => " ORDER BY c.holding_date DESC, c.created_at DESC",
            "created_at_asc" => " ORDER BY c.created_at ASC, c.holding_date ASC",
            "created_at_desc" => " ORDER BY c.created_at DESC, c.holding_date ASC",
            "credit_desc" => {
                " ORDER BY GREATEST(host.credit_score, COALESCE(guest.credit_score, 0)) DESC, c.holding_date ASC"
            }
            _ => " ORDER BY c.holding_date ASC, c.created_at DESC",
        };
        query_builder.push(order_clause);
        query_builder.push(" LIMIT ");
        query_builder.push_bind(query.limit.max(1));

        let rows = query_builder
            .build_query_as::<ChallengeSummaryRow>()
            .fetch_all(&self.pool)
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        Ok(rows.into_iter().map(ChallengeSummary::from).collect())
    }

    async fn get_detail(
        &self,
        challenge_id: &str,
        user_id: Option<i64>,
    ) -> Result<Option<ChallengeDetail>, DomainError> {
        let Some(summary) = self.fetch_summary(challenge_id, user_id).await? else {
            return Ok(None);
        };

        let activity = match summary.challenge.activity_id.as_deref() {
            Some(activity_id) => {
                let row = sqlx::query_as::<_, ActivityRow>(
                    r#"
                    SELECT
                        id, cover, start_time, end_time, holding_date, location, location_latitude, location_longitude,
                        name, opposing, status, description, home_team_id, away_team_id, color, opposing_color,
                        players_per_team, match_kind, source_activity_id, team_registration_count, created_at, updated_at
                    FROM rs_activity
                    WHERE id = $1
                    "#,
                )
                .bind(activity_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
                row.map(Activity::from)
            }
            None => None,
        };

        Ok(Some(ChallengeDetail { summary, activity }))
    }

    async fn count_individual_acceptances(&self, challenge_id: &str) -> Result<i64, DomainError> {
        sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)
            FROM rs_challenge_individual_acceptances
            WHERE challenge_id = $1
            "#,
        )
        .bind(challenge_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))
    }

    async fn user_has_overlapping_individual_acceptance(
        &self,
        user_id: i64,
        challenge_id: &str,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
    ) -> Result<bool, DomainError> {
        sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM rs_challenge_individual_acceptances acceptances
                INNER JOIN rs_challenges challenges ON challenges.id = acceptances.challenge_id
                WHERE acceptances.user_id = $1
                  AND acceptances.challenge_id <> $2
                  AND challenges.kind = 'individual'
                  AND challenges.status <> 'cancelled'
                  AND challenges.start_time < $4
                  AND challenges.end_time > $3
            )
            "#,
        )
        .bind(user_id)
        .bind(challenge_id)
        .bind(start_time)
        .bind(end_time)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))
    }

    async fn accept_with_activity(
        &self,
        challenge_id: &str,
        guest_team_id: &str,
        accepted_by_user_id: i64,
        activity: &Activity,
    ) -> Result<Challenge, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let status = sqlx::query_scalar::<_, String>(
            "SELECT status FROM rs_challenges WHERE id = $1 FOR UPDATE",
        )
        .bind(challenge_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?
        .ok_or_else(|| DomainError::NotFound("约队不存在".to_string()))?;

        if status != "open" {
            tx.rollback()
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
            return Err(DomainError::Conflict("该约队当前不可接".to_string()));
        }

        sqlx::query(
            r#"
            INSERT INTO rs_activity (
                id, cover, start_time, end_time, holding_date, location, location_latitude, location_longitude,
                name, opposing, status, description, home_team_id, away_team_id, color, opposing_color,
                players_per_team, match_kind, source_activity_id, team_registration_count, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22
            )
            "#,
        )
        .bind(&activity.id)
        .bind(&activity.cover)
        .bind(activity.start_time)
        .bind(activity.end_time)
        .bind(activity.holding_date)
        .bind(&activity.location)
        .bind(activity.location_latitude)
        .bind(activity.location_longitude)
        .bind(&activity.name)
        .bind(&activity.opposing)
        .bind(activity.status as i16)
        .bind(&activity.description)
        .bind(&activity.home_team_id)
        .bind(&activity.away_team_id)
        .bind(&activity.color)
        .bind(&activity.opposing_color)
        .bind(activity.players_per_team)
        .bind(activity.match_kind.as_deref().unwrap_or("external"))
        .bind(&activity.source_activity_id)
        .bind(activity.team_registration_count)
        .bind(activity.created_at)
        .bind(activity.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO rs_user_activity (activity_id, user_id, stand, registration_count, paid, operation_time, created_at, updated_at)
            SELECT $1, members.user_id, 0, 0, 0, NOW(), NOW(), NOW()
            FROM (
                SELECT DISTINCT tm.user_id
                FROM rs_team_members tm
                WHERE tm.team_id IN ($2, $3) AND tm.status = 1
            ) members
            WHERE NOT EXISTS (
                SELECT 1 FROM rs_user_activity ua WHERE ua.activity_id = $1 AND ua.user_id = members.user_id
            )
            "#,
        )
        .bind(&activity.id)
        .bind(activity.home_team_id.as_deref())
        .bind(activity.away_team_id.as_deref())
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        sqlx::query(
            r#"
            UPDATE rs_challenges
            SET guest_team_id = $1,
                accepted_by_user_id = $2,
                activity_id = $3,
                status = 'matched',
                accepted_at = NOW(),
                updated_at = NOW()
            WHERE id = $4
            "#,
        )
        .bind(guest_team_id)
        .bind(accepted_by_user_id)
        .bind(&activity.id)
        .bind(challenge_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            SELECT
                id, title, kind, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            FROM rs_challenges
            WHERE id = $1
            "#,
        )
        .bind(challenge_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(Challenge::from(row))
    }

    async fn accept_individual(
        &self,
        challenge_id: &str,
        user_id: i64,
    ) -> Result<Challenge, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            SELECT
                id, title, kind, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            FROM rs_challenges
            WHERE id = $1
            FOR UPDATE
            "#,
        )
        .bind(challenge_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?
        .ok_or_else(|| DomainError::NotFound("约队不存在".to_string()))?;

        if row.kind != "individual" {
            tx.rollback()
                .await
                .map_err(|error| DomainError::Infrastructure(error.to_string()))?;
            return Err(DomainError::Validation(
                "当前约队不支持散人接约".to_string(),
            ));
        }

        if row.status != "open" {
            tx.rollback()
                .await
                .map_err(|error| DomainError::Infrastructure(error.to_string()))?;
            return Err(DomainError::Conflict("该约队当前不可接".to_string()));
        }

        let insert_result = sqlx::query(
            r#"
            INSERT INTO rs_challenge_individual_acceptances (challenge_id, user_id, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (challenge_id, user_id) DO NOTHING
            "#,
        )
        .bind(challenge_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        if insert_result.rows_affected() == 0 {
            tx.rollback()
                .await
                .map_err(|error| DomainError::Infrastructure(error.to_string()))?;
            return Err(DomainError::Conflict("你已接过这场散人约队".to_string()));
        }

        let accepted_count = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)
            FROM rs_challenge_individual_acceptances
            WHERE challenge_id = $1
            "#,
        )
        .bind(challenge_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        let next_status = if accepted_count >= i64::from(row.players_per_team) {
            "matched"
        } else {
            "open"
        };

        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            UPDATE rs_challenges
            SET status = $2,
                accepted_at = CASE WHEN $2 = 'matched' THEN COALESCE(accepted_at, NOW()) ELSE accepted_at END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id, title, kind, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            "#,
        )
        .bind(challenge_id)
        .bind(next_status)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        tx.commit()
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        Ok(Challenge::from(row))
    }

    async fn cancel(
        &self,
        challenge_id: &str,
        _cancelled_by_user_id: i64,
    ) -> Result<Challenge, DomainError> {
        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            UPDATE rs_challenges
            SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING
                id, title, kind, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            "#,
        )
        .bind(challenge_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(Challenge::from(row))
    }
}
