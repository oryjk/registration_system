use crate::activity::domain::Activity;
use crate::activity::ports::ActivityQueryRepository;
use crate::team::application::TeamApplicationError;
use crate::team::application::commands::{
    SubmitActivityReviewCommand, TeamCreditPenaltyCommand, TeamMembershipRechargeCommand,
};
use crate::team::application::permission::TeamPermissionChecker;
use crate::team::application::principal::TeamPrincipal;
use crate::team::application::read_models::TeamCreditOverview;
use crate::team::domain::{
    Team, TeamCreditTransaction, clamp_credit_score, membership_credit_delta, membership_price,
    rating_to_credit_delta,
};
use crate::team::ports::{
    ActivityReviewRecord, MembershipRechargeRecord, TeamCommandRepository, TeamQueryRepository,
};
use chrono::Duration;
use std::sync::Arc;

#[derive(Clone)]
pub struct ManageTeamCreditUseCase {
    query_repository: Arc<dyn TeamQueryRepository>,
    command_repository: Arc<dyn TeamCommandRepository>,
    activity_repository: Arc<dyn ActivityQueryRepository>,
    permission_checker: TeamPermissionChecker,
}

impl ManageTeamCreditUseCase {
    pub fn new(
        query_repository: Arc<dyn TeamQueryRepository>,
        command_repository: Arc<dyn TeamCommandRepository>,
        activity_repository: Arc<dyn ActivityQueryRepository>,
    ) -> Self {
        let permission_checker = TeamPermissionChecker::new(query_repository.clone());
        Self {
            query_repository,
            command_repository,
            activity_repository,
            permission_checker,
        }
    }

    pub async fn get_credit_overview(
        &self,
        team_id: i64,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        let now = chrono::Utc::now().naive_utc();

        Ok(TeamCreditOverview {
            trust_label: team.trust_label_at(now),
            is_vip: team.is_vip_at(now),
            team,
        })
    }

    pub async fn list_credit_transactions(
        &self,
        team_id: i64,
        limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, TeamApplicationError> {
        self.permission_checker.get_team(team_id).await?;
        self.query_repository
            .list_credit_transactions(team_id, limit)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询信用流水失败: {error}")))
    }

    pub async fn submit_activity_review(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: SubmitActivityReviewCommand,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        if !principal.is_user() {
            return Err(TeamApplicationError::Forbidden);
        }

        if team_id != command.reviewer_team_id {
            return Err(TeamApplicationError::Validation(
                "互评球队与当前球队不一致".to_string(),
            ));
        }

        let Some(credit_delta) = rating_to_credit_delta(command.rating) else {
            return Err(TeamApplicationError::Validation(
                "评分必须是 1 到 5 分".to_string(),
            ));
        };

        if self
            .query_repository
            .find_activity_review(&command.activity_id, command.reviewer_team_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查互评状态失败: {error}")))?
            .is_some()
        {
            return Err(TeamApplicationError::Conflict(
                "该场比赛已经提交过互评".to_string(),
            ));
        }

        let reviewer_team = self
            .permission_checker
            .get_team(command.reviewer_team_id)
            .await?;
        if reviewer_team.captain_id != Some(principal.id) {
            return Err(TeamApplicationError::Forbidden);
        }

        let activity = self
            .activity_repository
            .find_by_id(&command.activity_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询比赛失败: {error}")))?
            .ok_or_else(|| TeamApplicationError::NotFound("比赛不存在".to_string()))?;

        ensure_reviewable_activity(&activity, command.reviewer_team_id)?;
        let reviewee_team_id = opposing_team_id(&activity, command.reviewer_team_id)?;
        let reviewee_team = self.permission_checker.get_team(reviewee_team_id).await?;
        let score_before = reviewee_team.credit_score;
        let score_after = clamp_credit_score(score_before + credit_delta);

        let updated_team = self
            .command_repository
            .record_activity_review(ActivityReviewRecord {
                activity_id: &command.activity_id,
                reviewer_team_id: command.reviewer_team_id,
                reviewer_user_id: principal.id,
                reviewee_team_id,
                rating: command.rating,
                credit_delta,
                comment: command.comment.as_deref(),
                score_before,
                score_after,
            })
            .await
            .map_err(|error| TeamApplicationError::internal(format!("保存互评失败: {error}")))?;

        Ok(credit_overview(updated_team))
    }

    pub async fn recharge_membership(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: TeamMembershipRechargeCommand,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        if !principal.is_user() {
            return Err(TeamApplicationError::Forbidden);
        }

        let team = self.permission_checker.get_team(team_id).await?;
        self.permission_checker
            .ensure_team_manager(principal, &team)
            .await?;

        let Some(credit_delta) = membership_credit_delta(command.months) else {
            return Err(TeamApplicationError::Validation(
                "充值月份必须大于 0".to_string(),
            ));
        };
        let Some(amount) = membership_price(command.months) else {
            return Err(TeamApplicationError::Validation(
                "会员充值金额计算失败".to_string(),
            ));
        };

        let now = chrono::Utc::now().naive_utc();
        let vip_base = team.vip_until.filter(|value| *value > now).unwrap_or(now);
        let vip_until = vip_base + Duration::days(i64::from(command.months) * 30);
        let score_before = team.credit_score;
        let score_after = clamp_credit_score(score_before + credit_delta);

        let updated_team = self
            .command_repository
            .record_membership_recharge(MembershipRechargeRecord {
                team_id,
                operator_user_id: principal.id,
                months: command.months,
                amount,
                credit_delta,
                vip_until,
                note: command.note.as_deref(),
                score_before,
                score_after,
            })
            .await
            .map_err(|error| TeamApplicationError::internal(format!("开通会员失败: {error}")))?;

        Ok(credit_overview(updated_team))
    }

    pub async fn apply_credit_penalty(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        command: TeamCreditPenaltyCommand,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        if !principal.is_admin() {
            return Err(TeamApplicationError::Forbidden);
        }

        if command.points <= 0 {
            return Err(TeamApplicationError::Validation(
                "罚扣分值必须大于 0".to_string(),
            ));
        }

        if command.reason.trim().is_empty() {
            return Err(TeamApplicationError::Validation(
                "罚扣原因不能为空".to_string(),
            ));
        }

        let team = self.permission_checker.get_team(team_id).await?;
        let score_before = team.credit_score;
        let score_after = clamp_credit_score(score_before - command.points);
        let updated_team = self
            .command_repository
            .record_credit_penalty(
                team_id,
                principal.id,
                command.points,
                &command.reason,
                score_before,
                score_after,
            )
            .await
            .map_err(|error| TeamApplicationError::internal(format!("信用罚扣失败: {error}")))?;

        Ok(credit_overview(updated_team))
    }
}

fn credit_overview(team: Team) -> TeamCreditOverview {
    let now = chrono::Utc::now().naive_utc();
    TeamCreditOverview {
        trust_label: team.trust_label_at(now),
        is_vip: team.is_vip_at(now),
        team,
    }
}

fn ensure_reviewable_activity(
    activity: &Activity,
    reviewer_team_id: i64,
) -> Result<(), TeamApplicationError> {
    if activity.status != 2 {
        return Err(TeamApplicationError::Validation(
            "只有已结束的比赛才允许互评".to_string(),
        ));
    }

    let home_team_id = activity.home_team_id;
    let away_team_id = activity.away_team_id;
    if home_team_id.is_none() || away_team_id.is_none() {
        return Err(TeamApplicationError::Validation(
            "当前比赛尚未绑定双方球队".to_string(),
        ));
    }

    if home_team_id != Some(reviewer_team_id) && away_team_id != Some(reviewer_team_id) {
        return Err(TeamApplicationError::Validation(
            "当前球队不在本场比赛中".to_string(),
        ));
    }

    Ok(())
}

fn opposing_team_id(
    activity: &Activity,
    reviewer_team_id: i64,
) -> Result<i64, TeamApplicationError> {
    match (activity.home_team_id, activity.away_team_id) {
        (Some(home_team_id), Some(away_team_id)) if home_team_id == reviewer_team_id => {
            Ok(away_team_id)
        }
        (Some(home_team_id), Some(away_team_id)) if away_team_id == reviewer_team_id => {
            Ok(home_team_id)
        }
        _ => Err(TeamApplicationError::Validation(
            "当前球队不在本场比赛中".to_string(),
        )),
    }
}
