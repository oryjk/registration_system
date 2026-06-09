use super::models::{
    ActivityRow, ChallengeIndividualParticipantPreviewRow, ChallengeIndividualParticipantRow,
    ChallengeRow, ChallengeSummaryRow,
};
use crate::activity::domain::Activity;
use crate::challenge::domain::{
    Challenge, ChallengeDetail, ChallengeIndividualParticipant, ChallengeKind, ChallengeStatus,
    ChallengeSummary, CurrentUserIndividualAcceptance, DomainError,
    IndividualAcceptancePaymentStatus,
};
use crate::challenge::ports::{
    AcceptIndividualFields, AdminChallengeRepositoryQuery, ChallengeCommandRepository,
    ChallengeQueryRepository, ExpiredIndividualAcceptance, PostpaidUnpaidAcceptance,
    TeamChallengeListQuery, UpdateChallengeFields,
};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::{PgPool, Postgres, QueryBuilder};
use std::collections::HashMap;

#[derive(Clone)]
pub struct PostgresChallengeRepository {
    pool: PgPool,
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
                c.payment_mode,
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
                c.min_players,
                c.max_players,
                c.fee_per_person,
                c.note,
                c.status,
                c.accepted_at,
                c.cancelled_at,
                c.created_at,
                c.updated_at,
                COALESCE(host.name, NULLIF(users.real_name, ''), NULLIF(users.nickname, ''), NULLIF(users.username, ''), '场馆约队') AS host_team_name,
                COALESCE(host.credit_score, 100) AS host_team_credit_score,
                CASE
                    WHEN COALESCE(host.credit_score, 100) >= 90 THEN '金牌信用'
                    WHEN COALESCE(host.credit_score, 100) >= 80 THEN '稳定赴约'
                    WHEN COALESCE(host.credit_score, 100) >= 70 THEN '评价稳定'
                    WHEN COALESCE(host.credit_score, 100) >= 60 THEN '活跃新队'
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
            LEFT JOIN rs_teams host ON host.id = c.host_team_id
            INNER JOIN rs_user_info users ON users.id = c.host_user_id
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

    async fn attach_individual_participant_preview(
        &self,
        items: Vec<ChallengeSummary>,
    ) -> Result<Vec<ChallengeSummary>, DomainError> {
        let challenge_ids = items
            .iter()
            .filter(|item| item.challenge.kind == ChallengeKind::Individual)
            .map(|item| item.challenge.id.as_str())
            .collect::<Vec<_>>();

        if challenge_ids.is_empty() {
            return Ok(items);
        }

        let rows = sqlx::query_as::<_, ChallengeIndividualParticipantPreviewRow>(
            r#"
            SELECT challenge_id, user_id, display_name, avatar_url
            FROM (
                SELECT
                    acceptances.challenge_id,
                    acceptances.user_id,
                    COALESCE(NULLIF(users.real_name, ''), NULLIF(users.nickname, ''), NULLIF(users.username, ''), '球员') AS display_name,
                    NULLIF(users.avatar_url, '') AS avatar_url,
                    ROW_NUMBER() OVER (
                        PARTITION BY acceptances.challenge_id
                        ORDER BY acceptances.created_at ASC, acceptances.id ASC
                    ) AS row_number
                FROM rs_challenge_individual_acceptances acceptances
                INNER JOIN rs_user_info users ON users.id = acceptances.user_id
                WHERE acceptances.challenge_id = ANY($1)
            ) preview
            WHERE row_number <= 3
            ORDER BY challenge_id ASC, row_number ASC
            "#,
        )
        .bind(&challenge_ids)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        let mut preview_by_challenge_id: HashMap<String, Vec<ChallengeIndividualParticipant>> =
            HashMap::new();
        for row in rows {
            preview_by_challenge_id
                .entry(row.challenge_id.clone())
                .or_default()
                .push(row.into_participant());
        }

        Ok(items
            .into_iter()
            .map(|mut item| {
                if let Some(preview) = preview_by_challenge_id.remove(&item.challenge.id) {
                    item.individual_participant_preview = preview;
                }
                item
            })
            .collect())
    }
}

#[async_trait]
impl ChallengeQueryRepository for PostgresChallengeRepository {
    async fn find_by_id(&self, challenge_id: &str) -> Result<Option<Challenge>, DomainError> {
        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            SELECT
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
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
                c.payment_mode,
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
                c.min_players,
                c.max_players,
                c.fee_per_person,
                c.note,
                c.status,
                c.accepted_at,
                c.cancelled_at,
                c.created_at,
                c.updated_at,
                COALESCE(host.name, NULLIF(users.real_name, ''), NULLIF(users.nickname, ''), NULLIF(users.username, ''), '场馆约队') AS host_team_name,
                COALESCE(host.credit_score, 100) AS host_team_credit_score,
                CASE
                    WHEN COALESCE(host.credit_score, 100) >= 90 THEN '金牌信用'
                    WHEN COALESCE(host.credit_score, 100) >= 80 THEN '稳定赴约'
                    WHEN COALESCE(host.credit_score, 100) >= 70 THEN '评价稳定'
                    WHEN COALESCE(host.credit_score, 100) >= 60 THEN '活跃新队'
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
            LEFT JOIN rs_teams host ON host.id = c.host_team_id
            INNER JOIN rs_user_info users ON users.id = c.host_user_id
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

        if let Some(kind) = query.kind {
            query_builder
                .push(" AND c.kind = ")
                .push_bind(kind.as_db_str());
        }

        if let Some(starts_after) = query.starts_after {
            query_builder
                .push(" AND c.start_time > ")
                .push_bind(starts_after);
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

        let items = rows
            .into_iter()
            .map(ChallengeSummary::from)
            .map(|mut summary| {
                summary.current_team_relation = Some(
                    if summary.challenge.host_team_id == Some(query.team_id) {
                        "host"
                    } else if summary.challenge.guest_team_id == Some(query.team_id) {
                        "guest"
                    } else {
                        "viewer"
                    }
                    .to_string(),
                );
                summary.can_accept = summary.challenge.status == ChallengeStatus::Open
                    && summary.challenge.host_team_id != Some(query.team_id)
                    && summary.challenge.guest_team_id != Some(query.team_id);
                summary
            })
            .collect();

        self.attach_individual_participant_preview(items).await
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
                c.payment_mode,
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
                c.min_players,
                c.max_players,
                c.fee_per_person,
                c.note,
                c.status,
                c.accepted_at,
                c.cancelled_at,
                c.created_at,
                c.updated_at,
                COALESCE(host.name, NULLIF(users.real_name, ''), NULLIF(users.nickname, ''), NULLIF(users.username, ''), '场馆约队') AS host_team_name,
                COALESCE(host.credit_score, 100) AS host_team_credit_score,
                CASE
                    WHEN COALESCE(host.credit_score, 100) >= 90 THEN '金牌信用'
                    WHEN COALESCE(host.credit_score, 100) >= 80 THEN '稳定赴约'
                    WHEN COALESCE(host.credit_score, 100) >= 70 THEN '评价稳定'
                    WHEN COALESCE(host.credit_score, 100) >= 60 THEN '活跃新队'
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
                    WHEN
            "#,
        );
        query_builder.push_bind(query.viewer_user_id);
        query_builder.push(
            r#"
                    ::bigint IS NULL THEN false
                    ELSE EXISTS(
                        SELECT 1
                        FROM rs_challenge_individual_acceptances acceptances
                        WHERE acceptances.challenge_id = c.id AND acceptances.user_id =
            "#,
        );
        query_builder.push_bind(query.viewer_user_id);
        query_builder.push(
            r#"
                    )
                END AS current_user_joined,
                false AS can_accept
            FROM rs_challenges c
            LEFT JOIN rs_teams host ON host.id = c.host_team_id
            INNER JOIN rs_user_info users ON users.id = c.host_user_id
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

        if let Some(kind) = query.kind {
            query_builder
                .push(" AND c.kind = ")
                .push_bind(kind.as_db_str());
        }

        if let Some(starts_after) = query.starts_after {
            query_builder
                .push(" AND c.start_time > ")
                .push_bind(starts_after);
        }

        if let Some(team_id) = query.team_id {
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

        let items = rows.into_iter().map(ChallengeSummary::from).collect();
        self.attach_individual_participant_preview(items).await
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
                        players_per_team, team_capacity_limit, match_kind, source_activity_id, team_registration_count, created_at, updated_at
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

        let individual_participants = if summary.challenge.kind == ChallengeKind::Individual {
            let rows = sqlx::query_as::<_, ChallengeIndividualParticipantRow>(
                r#"
                SELECT
                    acceptances.user_id,
                    COALESCE(NULLIF(users.real_name, ''), NULLIF(users.nickname, ''), NULLIF(users.username, ''), '球员') AS display_name,
                    NULLIF(users.avatar_url, '') AS avatar_url
                FROM rs_challenge_individual_acceptances acceptances
                INNER JOIN rs_user_info users ON users.id = acceptances.user_id
                WHERE acceptances.challenge_id = $1
                ORDER BY acceptances.created_at ASC, acceptances.id ASC
                "#,
            )
            .bind(challenge_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

            rows.into_iter()
                .map(ChallengeIndividualParticipant::from)
                .collect()
        } else {
            Vec::new()
        };

        let current_user_acceptance = match (summary.challenge.kind, user_id) {
            (ChallengeKind::Individual, Some(user_id)) => {
                let row = sqlx::query_as::<_, (String, Option<NaiveDateTime>, Option<String>)>(
                    r#"
                    SELECT payment_status, payment_deadline_at, payment_order_no
                    FROM rs_challenge_individual_acceptances
                    WHERE challenge_id = $1 AND user_id = $2
                    "#,
                )
                .bind(challenge_id)
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

                row.map(|(payment_status, payment_deadline_at, payment_order_no)| {
                    CurrentUserIndividualAcceptance {
                        payment_status: IndividualAcceptancePaymentStatus::from_db_str(
                            &payment_status,
                        ),
                        payment_deadline_at,
                        payment_order_no,
                    }
                })
            }
            _ => None,
        };

        Ok(Some(ChallengeDetail {
            summary,
            activity,
            individual_participants,
            current_user_acceptance,
        }))
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
}

#[async_trait]
impl ChallengeCommandRepository for PostgresChallengeRepository {
    async fn create(&self, challenge: &Challenge) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO rs_challenges (
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
            )
            "#,
        )
        .bind(&challenge.id)
        .bind(&challenge.title)
        .bind(challenge.kind.as_db_str())
        .bind(challenge.payment_mode.as_db_str())
        .bind(challenge.host_team_id)
        .bind(challenge.host_user_id)
        .bind(challenge.guest_team_id)
        .bind(challenge.accepted_by_user_id)
        .bind(&challenge.activity_id)
        .bind(challenge.holding_date)
        .bind(challenge.start_time)
        .bind(challenge.end_time)
        .bind(&challenge.location)
        .bind(challenge.location_latitude)
        .bind(challenge.location_longitude)
        .bind(challenge.players_per_team)
        .bind(challenge.min_players)
        .bind(challenge.max_players)
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

    async fn accept_with_activity(
        &self,
        challenge_id: &str,
        guest_team_id: i64,
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

        let existing_activity_id = sqlx::query_scalar::<_, Option<String>>(
            "SELECT activity_id FROM rs_challenges WHERE id = $1",
        )
        .bind(challenge_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        if existing_activity_id.is_some() {
            sqlx::query(
                r#"
                UPDATE rs_activity
                SET opposing = $1,
                    away_team_id = $2,
                    updated_at = NOW()
                WHERE id = $3
                "#,
            )
            .bind(&activity.opposing)
            .bind(activity.away_team_id)
            .bind(&activity.id)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        } else {
            sqlx::query(
                r#"
                INSERT INTO rs_activity (
                    id, cover, start_time, end_time, holding_date, location, location_latitude, location_longitude,
                    name, opposing, status, description, home_team_id, away_team_id, color, opposing_color,
                    players_per_team, team_capacity_limit, match_kind, source_activity_id, team_registration_count, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14, $15, $16,
                    $17, $18, $19, $20, $21, $22, $23
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
            .bind(activity.home_team_id)
            .bind(activity.away_team_id)
            .bind(&activity.color)
            .bind(&activity.opposing_color)
            .bind(activity.players_per_team)
            .bind(activity.team_capacity_limit)
            .bind(activity.match_kind.as_deref().unwrap_or("external"))
            .bind(&activity.source_activity_id)
            .bind(activity.team_registration_count)
            .bind(activity.created_at)
            .bind(activity.updated_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
        }

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
        .bind(activity.home_team_id)
        .bind(activity.away_team_id)
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
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
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

    async fn accept_as_host_team(
        &self,
        challenge_id: &str,
        host_team_id: i64,
        accepted_by_user_id: i64,
        activity: &Activity,
    ) -> Result<Challenge, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            SELECT
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            FROM rs_challenges
            WHERE id = $1
            FOR UPDATE
            "#,
        )
        .bind(challenge_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?
        .ok_or_else(|| DomainError::NotFound("约队不存在".to_string()))?;

        let challenge = Challenge::from(row);

        if challenge.status != ChallengeStatus::Open {
            tx.rollback()
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
            return Err(DomainError::Conflict("该约队当前不可接".to_string()));
        }
        if challenge.kind != ChallengeKind::Team || challenge.host_team_id.is_some() {
            tx.rollback()
                .await
                .map_err(|e| DomainError::Infrastructure(e.to_string()))?;
            return Err(DomainError::Conflict(
                "已有球队报名，等待另一支球队接约".to_string(),
            ));
        }

        sqlx::query(
            r#"
            INSERT INTO rs_activity (
                id, cover, start_time, end_time, holding_date, location, location_latitude, location_longitude,
                name, opposing, status, description, home_team_id, away_team_id, color, opposing_color,
                players_per_team, team_capacity_limit, match_kind, source_activity_id, team_registration_count, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23
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
        .bind(activity.home_team_id)
        .bind(activity.away_team_id)
        .bind(&activity.color)
        .bind(&activity.opposing_color)
        .bind(activity.players_per_team)
        .bind(activity.team_capacity_limit)
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
                WHERE tm.team_id = $2 AND tm.status = 1
            ) members
            WHERE NOT EXISTS (
                SELECT 1 FROM rs_user_activity ua WHERE ua.activity_id = $1 AND ua.user_id = members.user_id
            )
            "#,
        )
        .bind(&activity.id)
        .bind(host_team_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            UPDATE rs_challenges
            SET host_team_id = $1,
                accepted_by_user_id = $2,
                activity_id = $3,
                accepted_at = NOW(),
                updated_at = NOW()
            WHERE id = $4
            RETURNING
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            "#,
        )
        .bind(host_team_id)
        .bind(accepted_by_user_id)
        .bind(&activity.id)
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
        fields: AcceptIndividualFields<'_>,
    ) -> Result<Challenge, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            SELECT
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            FROM rs_challenges
            WHERE id = $1
            FOR UPDATE
            "#,
        )
        .bind(fields.challenge_id)
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
            INSERT INTO rs_challenge_individual_acceptances (
                challenge_id,
                user_id,
                payment_status,
                payment_deadline_at,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (challenge_id, user_id) DO NOTHING
            "#,
        )
        .bind(fields.challenge_id)
        .bind(fields.user_id)
        .bind(fields.payment_status.as_db_str())
        .bind(fields.payment_deadline_at)
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
        .bind(fields.challenge_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        let challenge = Challenge::from(row);
        let next_status = if accepted_count >= i64::from(challenge.min_signup_players()) {
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
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            "#,
        )
        .bind(fields.challenge_id)
        .bind(next_status)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        tx.commit()
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        Ok(Challenge::from(row))
    }

    async fn cancel_individual_acceptance(
        &self,
        challenge_id: &str,
        user_id: i64,
    ) -> Result<Challenge, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        let challenge = sqlx::query_as::<_, ChallengeRow>(
            r#"
            SELECT
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
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

        if challenge.kind != "individual" {
            tx.rollback()
                .await
                .map_err(|error| DomainError::Infrastructure(error.to_string()))?;
            return Err(DomainError::Validation(
                "只有散人约队支持取消个人报名".to_string(),
            ));
        }

        let delete_result = sqlx::query(
            "DELETE FROM rs_challenge_individual_acceptances WHERE challenge_id = $1 AND user_id = $2",
        )
        .bind(challenge_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        if delete_result.rows_affected() == 0 {
            tx.rollback()
                .await
                .map_err(|error| DomainError::Infrastructure(error.to_string()))?;
            return Err(DomainError::Conflict(
                "你还没有报名这场散人约队".to_string(),
            ));
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
        let challenge = Challenge::from(challenge);
        let next_status = if accepted_count >= i64::from(challenge.min_signup_players()) {
            "matched"
        } else {
            "open"
        };

        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            UPDATE rs_challenges
            SET status = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
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

    async fn update(
        &self,
        challenge_id: &str,
        fields: UpdateChallengeFields<'_>,
    ) -> Result<Challenge, DomainError> {
        let row = sqlx::query_as::<_, ChallengeRow>(
            r#"
            UPDATE rs_challenges
            SET title = $2,
                holding_date = $3,
                start_time = $4,
                end_time = $5,
                location = $6,
                location_latitude = $7,
                location_longitude = $8,
                players_per_team = $9,
                min_players = $10,
                max_players = $11,
                fee_per_person = $12,
                note = $13,
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            "#,
        )
        .bind(challenge_id)
        .bind(fields.title)
        .bind(fields.holding_date)
        .bind(fields.start_time)
        .bind(fields.end_time)
        .bind(fields.location)
        .bind(fields.location_latitude)
        .bind(fields.location_longitude)
        .bind(fields.players_per_team)
        .bind(fields.min_players)
        .bind(fields.max_players)
        .bind(fields.fee_per_person)
        .bind(fields.note)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?
        .ok_or_else(|| DomainError::NotFound("约队不存在".to_string()))?;

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
                id, title, kind, payment_mode, host_team_id, host_user_id, guest_team_id, accepted_by_user_id, activity_id,
                holding_date, start_time, end_time, location, location_latitude, location_longitude,
                players_per_team, min_players, max_players, fee_per_person, note, status, accepted_at, cancelled_at, created_at, updated_at
            "#,
        )
        .bind(challenge_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Infrastructure(e.to_string()))?;

        Ok(Challenge::from(row))
    }

    async fn cancel_expired_prepaid_acceptances(
        &self,
        now: NaiveDateTime,
    ) -> Result<Vec<ExpiredIndividualAcceptance>, DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        let rows = sqlx::query_as::<_, (String, i64)>(
            r#"
            DELETE FROM rs_challenge_individual_acceptances a
            USING rs_challenges c
            WHERE a.challenge_id = c.id
              AND c.kind = 'individual'
              AND c.payment_mode = 'prepaid'
              AND a.payment_status = 'unpaid'
              AND a.payment_deadline_at IS NOT NULL
              AND a.payment_deadline_at <= $1
            RETURNING a.challenge_id, a.user_id
            "#,
        )
        .bind(now)
        .fetch_all(&mut *tx)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        let challenge_ids = rows
            .iter()
            .map(|(challenge_id, _)| challenge_id.as_str())
            .collect::<Vec<_>>();
        if !challenge_ids.is_empty() {
            sqlx::query(
                r#"
                UPDATE rs_challenges
                SET status = 'open',
                    updated_at = NOW()
                WHERE id = ANY($1)
                  AND kind = 'individual'
                  AND status <> 'cancelled'
                "#,
            )
            .bind(&challenge_ids)
            .execute(&mut *tx)
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;
        }

        tx.commit()
            .await
            .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|(challenge_id, user_id)| ExpiredIndividualAcceptance {
                challenge_id,
                user_id,
            })
            .collect())
    }

    async fn mark_postpaid_unpaid_acceptances_notified(
        &self,
        now: NaiveDateTime,
    ) -> Result<Vec<PostpaidUnpaidAcceptance>, DomainError> {
        let rows = sqlx::query_as::<_, (String, i64, String)>(
            r#"
            UPDATE rs_challenge_individual_acceptances a
            SET payment_notified_at = $1,
                updated_at = NOW()
            FROM rs_challenges c
            WHERE a.challenge_id = c.id
              AND c.kind = 'individual'
              AND c.payment_mode = 'postpaid'
              AND c.end_time <= $1
              AND COALESCE(c.fee_per_person, 0.00) > 0
              AND a.payment_status = 'unpaid'
              AND a.payment_notified_at IS NULL
            RETURNING a.challenge_id, a.user_id, c.title
            "#,
        )
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| DomainError::Infrastructure(error.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|(challenge_id, user_id, title)| PostpaidUnpaidAcceptance {
                challenge_id,
                user_id,
                title,
            })
            .collect())
    }
}
