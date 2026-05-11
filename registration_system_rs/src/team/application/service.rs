use super::error::TeamApplicationError;
use super::principal::{TeamPrincipal, TeamRole};
use crate::activity::domain::Activity;
use crate::activity::ports::ActivityRepository;
use crate::team::domain::{
    DEFAULT_TEAM_CREDIT_SCORE, DomainError, Team, TeamAdminInfo, TeamCreditTransaction, TeamMember,
    TeamMemberWithInfo, clamp_credit_score, membership_credit_delta, membership_price,
    rating_to_credit_delta,
};
use crate::team::ports::{ActivityReviewRecord, MembershipRechargeRecord, TeamRepository};
use chrono::Duration;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct CreateTeamCommand {
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub join_password: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TeamDetail {
    pub team: Team,
    pub members: Vec<TeamMember>,
}

/// 管理后台球队详情（队员含球员信息 + 负责管理员列表）
#[derive(Debug, Clone)]
pub struct TeamDetailForAdmin {
    pub team: Team,
    pub members: Vec<TeamMemberWithInfo>,
    pub assigned_admins: Vec<TeamAdminInfo>,
}

#[derive(Debug, Clone)]
pub struct TeamSummary {
    pub team: Team,
    pub member_count: usize,
}

#[derive(Debug, Clone)]
pub struct TeamCreditOverview {
    pub team: Team,
    pub trust_label: String,
    pub is_vip: bool,
}

#[derive(Debug, Clone)]
pub struct UpdateTeamCommand {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub logo_url: Option<Option<String>>,
    pub captain_id: Option<Option<i64>>,
    pub status: Option<i8>,
    pub join_password: Option<Option<String>>,
}

#[derive(Debug, Clone)]
pub struct AddTeamMemberCommand {
    pub user_id: i64,
    pub role: Option<String>,
    pub jersey_number: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UpdateTeamMemberCommand {
    pub role: Option<String>,
    pub jersey_number: Option<Option<String>>,
}

#[derive(Debug, Clone)]
pub struct SubmitActivityReviewCommand {
    pub activity_id: String,
    pub reviewer_team_id: String,
    pub rating: i8,
    pub comment: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TeamMembershipRechargeCommand {
    pub months: i32,
    pub note: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TeamCreditPenaltyCommand {
    pub points: i32,
    pub reason: String,
}

#[derive(Clone)]
pub struct TeamService {
    repository: Arc<dyn TeamRepository>,
    activity_repository: Arc<dyn ActivityRepository>,
}

impl TeamService {
    pub fn new(
        repository: Arc<dyn TeamRepository>,
        activity_repository: Arc<dyn ActivityRepository>,
    ) -> Self {
        Self {
            repository,
            activity_repository,
        }
    }

    pub async fn create_team(
        &self,
        principal: &TeamPrincipal,
        command: CreateTeamCommand,
    ) -> Result<Team, TeamApplicationError> {
        if !principal.is_user() {
            return Err(TeamApplicationError::Forbidden);
        }

        if command.name.trim().is_empty() {
            return Err(TeamApplicationError::Validation(
                "球队名称不能为空".to_string(),
            ));
        }

        if self
            .repository
            .find_by_name(&command.name)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查球队名称失败: {error}")))?
            .is_some()
        {
            return Err(TeamApplicationError::Conflict("球队名称已存在".to_string()));
        }

        let password_hash = match command.join_password {
            Some(password) if !password.is_empty() => Some(
                bcrypt::hash(password, bcrypt::DEFAULT_COST).map_err(|error| {
                    TeamApplicationError::internal(format!("加密球队密码失败: {error}"))
                })?,
            ),
            _ => None,
        };

        let now = chrono::Utc::now().naive_utc();
        let team = Team {
            id: Uuid::new_v4().to_string(),
            name: command.name,
            description: command.description,
            logo_url: command.logo_url,
            captain_id: Some(principal.id),
            join_password_hash: password_hash,
            status: 1,
            credit_score: DEFAULT_TEAM_CREDIT_SCORE,
            vip_until: None,
            created_at: now,
            updated_at: now,
        };

        self.repository
            .create(&team)
            .await
            .map_err(|error| match error {
                DomainError::NameAlreadyExists => {
                    TeamApplicationError::Conflict("球队名称已存在".to_string())
                }
                other => TeamApplicationError::internal(format!("创建球队失败: {other}")),
            })?;
        self.repository
            .add_member(&team.id, principal.id, "captain", None)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("添加队长成员失败: {error}"))
            })?;

        Ok(team)
    }

    /// 管理后台创建球队（Admin 专用，可指定初始队长 ID）
    pub async fn admin_create_team(
        &self,
        principal: &TeamPrincipal,
        command: CreateTeamCommand,
        captain_id: Option<i64>,
    ) -> Result<Team, TeamApplicationError> {
        if !principal.is_admin() {
            return Err(TeamApplicationError::Forbidden);
        }

        if command.name.trim().is_empty() {
            return Err(TeamApplicationError::Validation(
                "球队名称不能为空".to_string(),
            ));
        }

        if self
            .repository
            .find_by_name(&command.name)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查球队名称失败: {error}")))?
            .is_some()
        {
            return Err(TeamApplicationError::Conflict("球队名称已存在".to_string()));
        }

        let password_hash = match command.join_password {
            Some(password) if !password.is_empty() => Some(
                bcrypt::hash(password, bcrypt::DEFAULT_COST).map_err(|error| {
                    TeamApplicationError::internal(format!("加密球队密码失败: {error}"))
                })?,
            ),
            _ => None,
        };

        let now = chrono::Utc::now().naive_utc();
        let team = Team {
            id: Uuid::new_v4().to_string(),
            name: command.name,
            description: command.description,
            logo_url: command.logo_url,
            captain_id,
            join_password_hash: password_hash,
            status: 1,
            credit_score: DEFAULT_TEAM_CREDIT_SCORE,
            vip_until: None,
            created_at: now,
            updated_at: now,
        };

        self.repository
            .create(&team)
            .await
            .map_err(|error| match error {
                DomainError::NameAlreadyExists => {
                    TeamApplicationError::Conflict("球队名称已存在".to_string())
                }
                other => TeamApplicationError::internal(format!("创建球队失败: {other}")),
            })?;

        if let Some(cid) = captain_id {
            self.repository
                .add_member(&team.id, cid, "captain", None)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("添加队长成员失败: {error}"))
                })?;
        }

        Ok(team)
    }

    /// 管理后台列表（超级管理员看全部，普通管理员只看被分配的球队）
    pub async fn admin_list_teams(
        &self,
        principal: &TeamPrincipal,
        active_only: bool,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        if !principal.is_admin() {
            return Err(TeamApplicationError::Forbidden);
        }

        let teams = if principal.is_super_admin {
            self.repository.list(active_only).await.map_err(|error| {
                TeamApplicationError::internal(format!("查询球队列表失败: {error}"))
            })?
        } else {
            self.repository
                .list_teams_by_admin(principal.id)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("查询管理员球队列表失败: {error}"))
                })?
        };
        self.attach_member_counts(teams).await
    }

    pub async fn list_teams(
        &self,
        active_only: bool,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        let teams = self.repository.list(active_only).await.map_err(|error| {
            TeamApplicationError::internal(format!("查询球队列表失败: {error}"))
        })?;

        self.attach_member_counts(teams).await
    }

    pub async fn search_teams(
        &self,
        keyword: &str,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        let teams =
            if keyword.trim().is_empty() {
                self.repository.list(true).await.map_err(|error| {
                    TeamApplicationError::internal(format!("查询球队失败: {error}"))
                })?
            } else {
                self.repository.search(keyword).await.map_err(|error| {
                    TeamApplicationError::internal(format!("搜索球队失败: {error}"))
                })?
            };

        self.attach_member_counts(teams).await
    }

    pub async fn get_team_detail(&self, team_id: &str) -> Result<TeamDetail, TeamApplicationError> {
        let team = self.get_team(team_id).await?;
        let members = self
            .repository
            .list_members(team_id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询球队成员失败: {error}"))
            })?;

        Ok(TeamDetail { team, members })
    }

    pub async fn join_team(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        password: Option<&str>,
    ) -> Result<(), TeamApplicationError> {
        if !principal.is_user() {
            return Err(TeamApplicationError::Forbidden);
        }

        let team = self.get_team(team_id).await?;

        if team.status != 1 {
            return Err(TeamApplicationError::Validation(
                "球队已解散或不可加入".to_string(),
            ));
        }

        if self
            .repository
            .is_member(team_id, principal.id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("检查球队成员关系失败: {error}"))
            })?
        {
            return Err(TeamApplicationError::Conflict(
                "您已经是该球队成员".to_string(),
            ));
        }

        if let Some(hash) = team.join_password_hash {
            let raw_password = password.unwrap_or_default();
            let password_ok = bcrypt::verify(raw_password, &hash).map_err(|error| {
                TeamApplicationError::internal(format!("验证球队密码失败: {error}"))
            })?;
            if !password_ok {
                return Err(TeamApplicationError::Validation("加入密码错误".to_string()));
            }
        }

        let member_status = self
            .repository
            .get_member_status(team_id, principal.id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("检查成员状态失败: {error}"))
            })?;

        match member_status {
            Some(0) => {
                self.repository
                    .reactivate_member(team_id, principal.id, "member", None)
                    .await
                    .map_err(|error| {
                        TeamApplicationError::internal(format!("重新加入球队失败: {error}"))
                    })?;
            }
            _ => {
                self.repository
                    .add_member(team_id, principal.id, "member", None)
                    .await
                    .map_err(|error| {
                        TeamApplicationError::internal(format!("加入球队失败: {error}"))
                    })?;
            }
        }

        Ok(())
    }

    pub async fn list_my_teams(
        &self,
        principal: &TeamPrincipal,
    ) -> Result<Vec<Team>, TeamApplicationError> {
        if !principal.is_user() {
            return Err(TeamApplicationError::Forbidden);
        }

        self.list_user_teams_for_target(principal, principal.id)
            .await
    }

    pub async fn list_user_teams_for_target(
        &self,
        principal: &TeamPrincipal,
        target_user_id: i64,
    ) -> Result<Vec<Team>, TeamApplicationError> {
        if !principal.is_admin() && principal.id != target_user_id {
            return Err(TeamApplicationError::Forbidden);
        }

        self.repository
            .list_user_teams(target_user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询用户球队失败: {error}")))
    }

    pub async fn update_team(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        command: UpdateTeamCommand,
    ) -> Result<(), TeamApplicationError> {
        let team = self.get_team(team_id).await?;
        self.ensure_team_manager(principal, &team).await?;

        let join_password_hash = match command.join_password {
            Some(Some(password)) if !password.trim().is_empty() => {
                Some(Some(bcrypt::hash(password, bcrypt::DEFAULT_COST).map_err(
                    |error| TeamApplicationError::internal(format!("加密球队密码失败: {error}")),
                )?))
            }
            Some(Some(_)) => Some(None),
            Some(None) => Some(None),
            None => None,
        };

        self.repository
            .update(
                team_id,
                crate::team::domain::UpdateTeamFields {
                    name: command.name.as_deref(),
                    description: command.description.as_ref().map(|value| value.as_deref()),
                    logo_url: command.logo_url.as_ref().map(|value| value.as_deref()),
                    captain_id: command.captain_id,
                    status: command.status,
                    join_password_hash: join_password_hash.as_ref().map(|value| value.as_deref()),
                },
            )
            .await
            .map_err(|error| TeamApplicationError::internal(format!("更新球队失败: {error}")))
    }

    pub async fn delete_team(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
    ) -> Result<(), TeamApplicationError> {
        if !principal.is_admin() || !principal.is_super_admin {
            return Err(TeamApplicationError::Forbidden);
        }

        self.get_team(team_id).await?;
        self.repository
            .delete(team_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("删除球队失败: {error}")))
    }

    pub async fn get_team_password_info(
        &self,
        team_id: &str,
    ) -> Result<bool, TeamApplicationError> {
        let team = self.get_team(team_id).await?;
        Ok(team.join_password_hash.is_some())
    }

    pub async fn add_member(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        command: AddTeamMemberCommand,
    ) -> Result<(), TeamApplicationError> {
        let team = self.get_team(team_id).await?;
        self.ensure_team_manager(principal, &team).await?;

        if self
            .repository
            .is_member(team_id, command.user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查成员失败: {error}")))?
        {
            return Err(TeamApplicationError::Conflict(
                "该用户已经是球队成员".to_string(),
            ));
        }

        match self
            .repository
            .get_member_status(team_id, command.user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查成员状态失败: {error}")))?
        {
            Some(0) => {
                self.repository
                    .reactivate_member(
                        team_id,
                        command.user_id,
                        command.role.as_deref().unwrap_or("member"),
                        command.jersey_number.as_deref(),
                    )
                    .await
                    .map_err(|error| {
                        TeamApplicationError::internal(format!("重新激活成员失败: {error}"))
                    })?;
            }
            _ => {
                self.repository
                    .add_member(
                        team_id,
                        command.user_id,
                        command.role.as_deref().unwrap_or("member"),
                        command.jersey_number.as_deref(),
                    )
                    .await
                    .map_err(|error| match error {
                        DomainError::AlreadyMember => {
                            TeamApplicationError::Conflict("该用户已经是球队成员".to_string())
                        }
                        other => TeamApplicationError::internal(format!("添加成员失败: {other}")),
                    })?;
            }
        }

        Ok(())
    }

    pub async fn remove_member(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        target_user_id: i64,
    ) -> Result<(), TeamApplicationError> {
        let team = self.get_team(team_id).await?;
        let is_self = principal.is_user() && principal.id == target_user_id;
        if !is_self {
            self.ensure_team_manager(principal, &team).await?;
        }

        if !self
            .repository
            .is_member(team_id, target_user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查成员失败: {error}")))?
        {
            return Err(TeamApplicationError::NotFound(
                "该用户不是球队成员".to_string(),
            ));
        }

        self.repository
            .remove_member(team_id, target_user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("移除成员失败: {error}")))
    }

    pub async fn batch_remove_members(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        user_ids: &[i64],
    ) -> Result<u64, TeamApplicationError> {
        let team = self.get_team(team_id).await?;
        self.ensure_team_manager(principal, &team).await?;
        if user_ids.is_empty() {
            return Ok(0);
        }
        self.repository
            .batch_remove_members(team_id, user_ids)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("批量移除成员失败: {error}")))
    }

    pub async fn batch_update_member_status(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        user_ids: &[i64],
        status: i8,
    ) -> Result<u64, TeamApplicationError> {
        let team = self.get_team(team_id).await?;
        self.ensure_team_manager(principal, &team).await?;
        if user_ids.is_empty() {
            return Ok(0);
        }
        if !matches!(status, 0 | 1) {
            return Err(TeamApplicationError::Validation(
                "队员状态只能是 0 或 1".to_string(),
            ));
        }
        self.repository
            .batch_update_member_status(team_id, user_ids, status)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("批量更新成员状态失败: {error}"))
            })
    }

    pub async fn update_member(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        target_user_id: i64,
        command: UpdateTeamMemberCommand,
    ) -> Result<(), TeamApplicationError> {
        let team = self.get_team(team_id).await?;
        self.ensure_team_manager(principal, &team).await?;

        if !self
            .repository
            .is_member(team_id, target_user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查成员失败: {error}")))?
        {
            return Err(TeamApplicationError::NotFound(
                "该用户不是球队成员".to_string(),
            ));
        }

        self.repository
            .update_member(
                team_id,
                target_user_id,
                command.role.as_deref(),
                command.jersey_number.as_ref().map(|value| value.as_deref()),
            )
            .await
            .map_err(|error| TeamApplicationError::internal(format!("更新成员失败: {error}")))
    }

    /// 管理后台：球队详情（队员含球员名字/头像/手机号，以及负责管理员列表）
    pub async fn get_team_detail_for_admin(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
    ) -> Result<TeamDetailForAdmin, TeamApplicationError> {
        if !principal.is_admin() {
            return Err(TeamApplicationError::Forbidden);
        }
        let team = self.get_team(team_id).await?;

        if !principal.is_super_admin {
            let assigned = self
                .repository
                .is_admin_assigned(team_id, principal.id)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("检查权限失败: {error}"))
                })?;
            if !assigned {
                return Err(TeamApplicationError::Forbidden);
            }
        }

        let members = self
            .repository
            .list_members_with_info(team_id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询球队成员失败: {error}"))
            })?;
        let assigned_admins = self
            .repository
            .list_team_admins_with_info(team_id)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询球队管理员失败: {error}"))
            })?;

        Ok(TeamDetailForAdmin {
            team,
            members,
            assigned_admins,
        })
    }

    /// 超级管理员给球队指定一名后台管理员
    pub async fn assign_admin_to_team(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        admin_id: i64,
    ) -> Result<(), TeamApplicationError> {
        if !principal.is_admin() || !principal.is_super_admin {
            return Err(TeamApplicationError::Forbidden);
        }

        self.get_team(team_id).await?;
        self.repository
            .assign_admin(team_id, admin_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("分配管理员失败: {error}")))
    }

    /// 超级管理员取消球队的管理员分配
    pub async fn unassign_admin_from_team(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        admin_id: i64,
    ) -> Result<(), TeamApplicationError> {
        if !principal.is_admin() || !principal.is_super_admin {
            return Err(TeamApplicationError::Forbidden);
        }

        self.get_team(team_id).await?;
        self.repository
            .unassign_admin(team_id, admin_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("取消管理员分配失败: {error}")))
    }

    /// 查询球队的后台管理员列表
    pub async fn list_team_assigned_admins(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
    ) -> Result<Vec<TeamAdminInfo>, TeamApplicationError> {
        if !principal.is_admin() {
            return Err(TeamApplicationError::Forbidden);
        }

        self.get_team(team_id).await?;
        self.repository
            .list_team_admins_with_info(team_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询球队管理员失败: {error}")))
    }

    pub async fn get_credit_overview(
        &self,
        team_id: &str,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        let team = self.get_team(team_id).await?;
        let now = chrono::Utc::now().naive_utc();

        Ok(TeamCreditOverview {
            trust_label: team.trust_label_at(now),
            is_vip: team.is_vip_at(now),
            team,
        })
    }

    pub async fn list_credit_transactions(
        &self,
        team_id: &str,
        limit: i64,
    ) -> Result<Vec<TeamCreditTransaction>, TeamApplicationError> {
        self.get_team(team_id).await?;
        self.repository
            .list_credit_transactions(team_id, limit)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询信用流水失败: {error}")))
    }

    pub async fn submit_activity_review(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
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
            .repository
            .find_activity_review(&command.activity_id, &command.reviewer_team_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查互评状态失败: {error}")))?
            .is_some()
        {
            return Err(TeamApplicationError::Conflict(
                "该场比赛已经提交过互评".to_string(),
            ));
        }

        let reviewer_team = self.get_team(&command.reviewer_team_id).await?;
        if reviewer_team.captain_id != Some(principal.id) {
            return Err(TeamApplicationError::Forbidden);
        }

        let activity = self
            .activity_repository
            .find_by_id(&command.activity_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询比赛失败: {error}")))?
            .ok_or_else(|| TeamApplicationError::NotFound("比赛不存在".to_string()))?;

        self.ensure_reviewable_activity(&activity, &command.reviewer_team_id)?;
        let reviewee_team_id = opposing_team_id(&activity, &command.reviewer_team_id)?;
        let reviewee_team = self.get_team(&reviewee_team_id).await?;
        let score_before = reviewee_team.credit_score;
        let score_after = clamp_credit_score(score_before + credit_delta);

        let updated_team = self
            .repository
            .record_activity_review(ActivityReviewRecord {
                activity_id: &command.activity_id,
                reviewer_team_id: &command.reviewer_team_id,
                reviewer_user_id: principal.id,
                reviewee_team_id: &reviewee_team_id,
                rating: command.rating,
                credit_delta,
                comment: command.comment.as_deref(),
                score_before,
                score_after,
            })
            .await
            .map_err(|error| TeamApplicationError::internal(format!("保存互评失败: {error}")))?;

        let now = chrono::Utc::now().naive_utc();
        Ok(TeamCreditOverview {
            trust_label: updated_team.trust_label_at(now),
            is_vip: updated_team.is_vip_at(now),
            team: updated_team,
        })
    }

    pub async fn recharge_membership(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
        command: TeamMembershipRechargeCommand,
    ) -> Result<TeamCreditOverview, TeamApplicationError> {
        if !principal.is_user() {
            return Err(TeamApplicationError::Forbidden);
        }

        let team = self.get_team(team_id).await?;
        self.ensure_team_manager(principal, &team).await?;

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
            .repository
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

        Ok(TeamCreditOverview {
            trust_label: updated_team.trust_label_at(now),
            is_vip: updated_team.is_vip_at(now),
            team: updated_team,
        })
    }

    pub async fn apply_credit_penalty(
        &self,
        principal: &TeamPrincipal,
        team_id: &str,
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

        let team = self.get_team(team_id).await?;
        let score_before = team.credit_score;
        let score_after = clamp_credit_score(score_before - command.points);
        let updated_team = self
            .repository
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

        let now = chrono::Utc::now().naive_utc();
        Ok(TeamCreditOverview {
            trust_label: updated_team.trust_label_at(now),
            is_vip: updated_team.is_vip_at(now),
            team: updated_team,
        })
    }

    async fn get_team(&self, team_id: &str) -> Result<Team, TeamApplicationError> {
        self.repository
            .find_by_id(team_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("查询球队失败: {error}")))?
            .ok_or_else(|| TeamApplicationError::NotFound("球队不存在".to_string()))
    }

    /// 权限检查：只有超级管理员、被分配的普通管理员，或球队队长本人可以管理球队
    async fn ensure_team_manager(
        &self,
        principal: &TeamPrincipal,
        team: &Team,
    ) -> Result<(), TeamApplicationError> {
        if principal.role == TeamRole::Admin {
            if principal.is_super_admin {
                return Ok(());
            }

            let assigned = self
                .repository
                .is_admin_assigned(&team.id, principal.id)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("检查管理员权限失败: {error}"))
                })?;

            return if assigned {
                Ok(())
            } else {
                Err(TeamApplicationError::Forbidden)
            };
        }

        if principal.role == TeamRole::User && team.captain_id == Some(principal.id) {
            return Ok(());
        }

        Err(TeamApplicationError::Forbidden)
    }

    async fn attach_member_counts(
        &self,
        teams: Vec<Team>,
    ) -> Result<Vec<TeamSummary>, TeamApplicationError> {
        let mut result = Vec::with_capacity(teams.len());
        for team in teams {
            let count = self
                .repository
                .list_members(&team.id)
                .await
                .map_err(|error| {
                    TeamApplicationError::internal(format!("查询球队成员失败: {error}"))
                })?;
            result.push(TeamSummary {
                team,
                member_count: count.len(),
            });
        }
        Ok(result)
    }

    fn ensure_reviewable_activity(
        &self,
        activity: &Activity,
        reviewer_team_id: &str,
    ) -> Result<(), TeamApplicationError> {
        if activity.status != 2 {
            return Err(TeamApplicationError::Validation(
                "只有已结束的比赛才允许互评".to_string(),
            ));
        }

        let home_team_id = activity.home_team_id.as_deref();
        let away_team_id = activity.away_team_id.as_deref();
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
}

fn opposing_team_id(
    activity: &Activity,
    reviewer_team_id: &str,
) -> Result<String, TeamApplicationError> {
    match (
        activity.home_team_id.as_deref(),
        activity.away_team_id.as_deref(),
    ) {
        (Some(home_team_id), Some(away_team_id)) if home_team_id == reviewer_team_id => {
            Ok(away_team_id.to_string())
        }
        (Some(home_team_id), Some(away_team_id)) if away_team_id == reviewer_team_id => {
            Ok(home_team_id.to_string())
        }
        _ => Err(TeamApplicationError::Validation(
            "当前球队不在本场比赛中".to_string(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::activity::domain::{
        Activity, ActivityCheckInRecord, ActivityListPage, ActivityRegistration,
        ActivityTeamCheckInConfig, DomainError as ActivityDomainError, RegistrationListPage,
        UpdateActivityFields,
    };
    use crate::activity::ports::ActivityRepository;
    use crate::team::domain::{
        ActivityTeamReview, DEFAULT_TEAM_CREDIT_SCORE, DomainError, Team, TeamAdminInfo,
        TeamCreditTransaction, TeamMember, TeamMemberWithInfo, UpdateTeamFields,
    };
    use crate::team::ports::TeamRepository;
    use async_trait::async_trait;
    use chrono::Utc;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    #[derive(Default)]
    struct FakeTeamRepository {
        teams: Mutex<HashMap<String, Team>>,
        members: Mutex<HashMap<String, Vec<TeamMember>>>,
        credit_transactions: Mutex<HashMap<String, Vec<TeamCreditTransaction>>>,
        reviews: Mutex<HashMap<(String, String), ActivityTeamReview>>,
    }

    #[async_trait]
    impl TeamRepository for FakeTeamRepository {
        async fn create(&self, team: &Team) -> Result<(), DomainError> {
            self.teams
                .lock()
                .expect("teams mutex poisoned")
                .insert(team.id.clone(), team.clone());
            Ok(())
        }

        async fn find_by_id(&self, team_id: &str) -> Result<Option<Team>, DomainError> {
            Ok(self
                .teams
                .lock()
                .expect("teams mutex poisoned")
                .get(team_id)
                .cloned())
        }

        async fn find_by_name(&self, name: &str) -> Result<Option<Team>, DomainError> {
            Ok(self
                .teams
                .lock()
                .expect("teams mutex poisoned")
                .values()
                .find(|team| team.name == name)
                .cloned())
        }

        async fn list(&self, _active_only: bool) -> Result<Vec<Team>, DomainError> {
            Ok(self
                .teams
                .lock()
                .expect("teams mutex poisoned")
                .values()
                .cloned()
                .collect())
        }

        async fn search(&self, _keyword: &str) -> Result<Vec<Team>, DomainError> {
            self.list(true).await
        }

        async fn update(
            &self,
            _team_id: &str,
            _fields: UpdateTeamFields<'_>,
        ) -> Result<(), DomainError> {
            Ok(())
        }

        async fn delete(&self, _team_id: &str) -> Result<(), DomainError> {
            Ok(())
        }

        async fn add_member(
            &self,
            team_id: &str,
            user_id: i64,
            role: &str,
            jersey_number: Option<&str>,
        ) -> Result<(), DomainError> {
            let mut members = self.members.lock().expect("members mutex poisoned");
            members
                .entry(team_id.to_string())
                .or_default()
                .push(TeamMember {
                    id: user_id,
                    team_id: team_id.to_string(),
                    user_id,
                    role: role.to_string(),
                    jersey_number: jersey_number.map(str::to_string),
                    joined_at: Utc::now().naive_utc(),
                    status: 1,
                    created_at: Utc::now().naive_utc(),
                    updated_at: Utc::now().naive_utc(),
                });
            Ok(())
        }

        async fn reactivate_member(
            &self,
            _team_id: &str,
            _user_id: i64,
            _role: &str,
            _jersey_number: Option<&str>,
        ) -> Result<(), DomainError> {
            Ok(())
        }

        async fn remove_member(&self, _team_id: &str, _user_id: i64) -> Result<(), DomainError> {
            Ok(())
        }

        async fn batch_remove_members(
            &self,
            _team_id: &str,
            _user_ids: &[i64],
        ) -> Result<u64, DomainError> {
            Ok(0)
        }

        async fn update_member(
            &self,
            _team_id: &str,
            _user_id: i64,
            _role: Option<&str>,
            _jersey_number: Option<Option<&str>>,
        ) -> Result<(), DomainError> {
            Ok(())
        }

        async fn batch_update_member_status(
            &self,
            _team_id: &str,
            _user_ids: &[i64],
            _status: i8,
        ) -> Result<u64, DomainError> {
            Ok(0)
        }

        async fn is_member(&self, team_id: &str, user_id: i64) -> Result<bool, DomainError> {
            Ok(self
                .members
                .lock()
                .expect("members mutex poisoned")
                .get(team_id)
                .is_some_and(|items| items.iter().any(|member| member.user_id == user_id)))
        }

        async fn get_member_status(
            &self,
            _team_id: &str,
            _user_id: i64,
        ) -> Result<Option<i8>, DomainError> {
            Ok(Some(1))
        }

        async fn list_members(&self, team_id: &str) -> Result<Vec<TeamMember>, DomainError> {
            Ok(self
                .members
                .lock()
                .expect("members mutex poisoned")
                .get(team_id)
                .cloned()
                .unwrap_or_default())
        }

        async fn list_user_teams(&self, user_id: i64) -> Result<Vec<Team>, DomainError> {
            let teams = self.teams.lock().expect("teams mutex poisoned");
            let members = self.members.lock().expect("members mutex poisoned");
            Ok(teams
                .values()
                .filter(|team| {
                    members
                        .get(&team.id)
                        .is_some_and(|items| items.iter().any(|member| member.user_id == user_id))
                })
                .cloned()
                .collect())
        }

        async fn list_members_with_info(
            &self,
            _team_id: &str,
        ) -> Result<Vec<TeamMemberWithInfo>, DomainError> {
            Ok(Vec::new())
        }

        async fn assign_admin(&self, _team_id: &str, _admin_id: i64) -> Result<(), DomainError> {
            Ok(())
        }

        async fn unassign_admin(&self, _team_id: &str, _admin_id: i64) -> Result<(), DomainError> {
            Ok(())
        }

        async fn list_team_admins_with_info(
            &self,
            _team_id: &str,
        ) -> Result<Vec<TeamAdminInfo>, DomainError> {
            Ok(Vec::new())
        }

        async fn is_admin_assigned(
            &self,
            _team_id: &str,
            _admin_id: i64,
        ) -> Result<bool, DomainError> {
            Ok(false)
        }

        async fn list_teams_by_admin(&self, _admin_id: i64) -> Result<Vec<Team>, DomainError> {
            Ok(Vec::new())
        }

        async fn list_credit_transactions(
            &self,
            team_id: &str,
            limit: i64,
        ) -> Result<Vec<TeamCreditTransaction>, DomainError> {
            let items = self
                .credit_transactions
                .lock()
                .expect("credit transactions mutex poisoned")
                .get(team_id)
                .cloned()
                .unwrap_or_default();
            Ok(items.into_iter().take(limit.max(0) as usize).collect())
        }

        async fn find_activity_review(
            &self,
            activity_id: &str,
            reviewer_team_id: &str,
        ) -> Result<Option<ActivityTeamReview>, DomainError> {
            Ok(self
                .reviews
                .lock()
                .expect("reviews mutex poisoned")
                .get(&(activity_id.to_string(), reviewer_team_id.to_string()))
                .cloned())
        }

        async fn record_activity_review(
            &self,
            record: ActivityReviewRecord<'_>,
        ) -> Result<Team, DomainError> {
            let mut teams = self.teams.lock().expect("teams mutex poisoned");
            let team = teams
                .get_mut(record.reviewee_team_id)
                .expect("reviewee team should exist");
            team.credit_score = record.score_after;
            team.updated_at = Utc::now().naive_utc();

            let review = ActivityTeamReview {
                id: 1,
                activity_id: record.activity_id.to_string(),
                reviewer_team_id: record.reviewer_team_id.to_string(),
                reviewer_user_id: record.reviewer_user_id,
                reviewee_team_id: record.reviewee_team_id.to_string(),
                rating: record.rating,
                credit_delta: record.credit_delta,
                comment: record.comment.map(str::to_string),
                created_at: Utc::now().naive_utc(),
                updated_at: Utc::now().naive_utc(),
            };
            self.reviews.lock().expect("reviews mutex poisoned").insert(
                (
                    record.activity_id.to_string(),
                    record.reviewer_team_id.to_string(),
                ),
                review,
            );

            self.credit_transactions
                .lock()
                .expect("credit transactions mutex poisoned")
                .entry(record.reviewee_team_id.to_string())
                .or_default()
                .push(TeamCreditTransaction {
                    id: 1,
                    team_id: record.reviewee_team_id.to_string(),
                    activity_id: Some(record.activity_id.to_string()),
                    transaction_type: "match_review".to_string(),
                    delta: record.credit_delta,
                    score_before: record.score_before,
                    score_after: record.score_after,
                    rating: Some(record.rating),
                    amount: None,
                    membership_months: None,
                    note: record.comment.map(str::to_string),
                    reviewer_team_id: Some(record.reviewer_team_id.to_string()),
                    created_by_user_id: Some(record.reviewer_user_id),
                    created_by_admin_id: None,
                    created_at: Utc::now().naive_utc(),
                });

            Ok(team.clone())
        }

        async fn record_membership_recharge(
            &self,
            record: MembershipRechargeRecord<'_>,
        ) -> Result<Team, DomainError> {
            let mut teams = self.teams.lock().expect("teams mutex poisoned");
            let team = teams.get_mut(record.team_id).expect("team should exist");
            team.credit_score = record.score_after;
            team.vip_until = Some(record.vip_until);
            team.updated_at = Utc::now().naive_utc();

            self.credit_transactions
                .lock()
                .expect("credit transactions mutex poisoned")
                .entry(record.team_id.to_string())
                .or_default()
                .push(TeamCreditTransaction {
                    id: 2,
                    team_id: record.team_id.to_string(),
                    activity_id: None,
                    transaction_type: "membership_recharge".to_string(),
                    delta: record.credit_delta,
                    score_before: record.score_before,
                    score_after: record.score_after,
                    rating: None,
                    amount: Some(record.amount),
                    membership_months: Some(record.months),
                    note: record.note.map(str::to_string),
                    reviewer_team_id: None,
                    created_by_user_id: Some(record.operator_user_id),
                    created_by_admin_id: None,
                    created_at: Utc::now().naive_utc(),
                });

            Ok(team.clone())
        }

        async fn record_credit_penalty(
            &self,
            team_id: &str,
            admin_id: i64,
            points: i32,
            reason: &str,
            score_before: i32,
            score_after: i32,
        ) -> Result<Team, DomainError> {
            let mut teams = self.teams.lock().expect("teams mutex poisoned");
            let team = teams.get_mut(team_id).expect("team should exist");
            team.credit_score = score_after;
            team.updated_at = Utc::now().naive_utc();

            self.credit_transactions
                .lock()
                .expect("credit transactions mutex poisoned")
                .entry(team_id.to_string())
                .or_default()
                .push(TeamCreditTransaction {
                    id: 3,
                    team_id: team_id.to_string(),
                    activity_id: None,
                    transaction_type: "manual_penalty".to_string(),
                    delta: -points,
                    score_before,
                    score_after,
                    rating: None,
                    amount: None,
                    membership_months: None,
                    note: Some(reason.to_string()),
                    reviewer_team_id: None,
                    created_by_user_id: None,
                    created_by_admin_id: Some(admin_id),
                    created_at: Utc::now().naive_utc(),
                });

            Ok(team.clone())
        }
    }

    struct DummyActivityRepository {
        activities: Mutex<HashMap<String, Activity>>,
    }

    impl DummyActivityRepository {
        fn with_activity(activity: Activity) -> Self {
            let mut activities = HashMap::new();
            activities.insert(activity.id.clone(), activity);
            Self {
                activities: Mutex::new(activities),
            }
        }
    }

    #[async_trait]
    impl ActivityRepository for DummyActivityRepository {
        async fn create(&self, _activity: &Activity) -> Result<(), ActivityDomainError> {
            unreachable!("not used")
        }

        async fn list_page(
            &self,
            _status_filter: Option<i8>,
            _page: u32,
            _page_size: u32,
        ) -> Result<ActivityListPage, ActivityDomainError> {
            unreachable!("not used")
        }

        async fn find_by_id(
            &self,
            activity_id: &str,
        ) -> Result<Option<Activity>, ActivityDomainError> {
            Ok(self
                .activities
                .lock()
                .expect("activities mutex poisoned")
                .get(activity_id)
                .cloned())
        }

        async fn find_derived_by_source_and_team(
            &self,
            _source_activity_id: &str,
            _team_id: &str,
        ) -> Result<Option<Activity>, ActivityDomainError> {
            Ok(None)
        }

        async fn delete_many(&self, _ids: &[String]) -> Result<(), ActivityDomainError> {
            unreachable!("not used")
        }

        async fn update_status(
            &self,
            _activity_id: &str,
            _status: i8,
        ) -> Result<(), ActivityDomainError> {
            unreachable!("not used")
        }

        async fn update_activity(
            &self,
            _activity_id: &str,
            _fields: UpdateActivityFields<'_>,
        ) -> Result<(), ActivityDomainError> {
            unreachable!("not used")
        }

        async fn find_ongoing_activity(&self) -> Result<Option<Activity>, ActivityDomainError> {
            unreachable!("not used")
        }

        async fn upsert_registration(
            &self,
            _activity_id: &str,
            _user_id: i64,
            _stand: i8,
            _registration_count: i32,
        ) -> Result<(), ActivityDomainError> {
            unreachable!("not used")
        }

        async fn delete_registration(
            &self,
            _activity_id: &str,
            _user_id: i64,
        ) -> Result<u64, ActivityDomainError> {
            unreachable!("not used")
        }

        async fn backfill_team_member_registrations(
            &self,
            _activity_id: &str,
        ) -> Result<u64, ActivityDomainError> {
            unreachable!("not used")
        }

        async fn list_registrations(
            &self,
            _activity_id: &str,
        ) -> Result<Vec<ActivityRegistration>, ActivityDomainError> {
            unreachable!("not used")
        }

        async fn count_capacity_registrations(
            &self,
            _activity_id: &str,
        ) -> Result<i64, ActivityDomainError> {
            Ok(0)
        }

        async fn list_registrations_with_info_page(
            &self,
            _activity_id: &str,
            _activity_holding_date: chrono::NaiveDateTime,
            _stand_filter: Option<i8>,
            _page: u32,
            _page_size: u32,
        ) -> Result<RegistrationListPage, ActivityDomainError> {
            unreachable!("not used")
        }

        async fn list_team_checkin_configs(
            &self,
            _activity_id: &str,
        ) -> Result<Vec<ActivityTeamCheckInConfig>, ActivityDomainError> {
            Ok(Vec::new())
        }

        async fn upsert_team_checkin_config(
            &self,
            _config: &ActivityTeamCheckInConfig,
        ) -> Result<(), ActivityDomainError> {
            Ok(())
        }

        async fn find_team_checkin_config(
            &self,
            _activity_id: &str,
            _team_id: &str,
        ) -> Result<Option<ActivityTeamCheckInConfig>, ActivityDomainError> {
            Ok(None)
        }

        async fn record_checkin(
            &self,
            record: &ActivityCheckInRecord,
        ) -> Result<ActivityCheckInRecord, ActivityDomainError> {
            Ok(record.clone())
        }

        async fn find_checkin_record(
            &self,
            _activity_id: &str,
            _team_id: &str,
            _user_id: i64,
        ) -> Result<Option<ActivityCheckInRecord>, ActivityDomainError> {
            Ok(None)
        }
    }

    #[tokio::test]
    async fn captain_can_submit_post_match_review_and_raise_opponent_credit() {
        let repository = Arc::new(FakeTeamRepository::default());
        let now = Utc::now().naive_utc();
        let activity = Activity {
            id: "activity-1".to_string(),
            cover: None,
            start_time: now,
            end_time: now,
            holding_date: now,
            location: "球场".to_string(),
            location_latitude: None,
            location_longitude: None,
            name: "约战".to_string(),
            opposing: None,
            status: 2,
            description: None,
            home_team_id: Some("team-a".to_string()),
            away_team_id: Some("team-b".to_string()),
            color: None,
            opposing_color: None,
            players_per_team: Some(7),
            source_activity_id: None,
            team_registration_count: None,
            team_checkin_configs: vec![],
            created_at: now,
            updated_at: now,
        };

        repository
            .create(&Team {
                id: "team-a".to_string(),
                name: "A".to_string(),
                description: None,
                logo_url: None,
                captain_id: Some(1),
                join_password_hash: None,
                status: 1,
                credit_score: DEFAULT_TEAM_CREDIT_SCORE,
                vip_until: None,
                created_at: now,
                updated_at: now,
            })
            .await
            .expect("create team a");
        repository
            .create(&Team {
                id: "team-b".to_string(),
                name: "B".to_string(),
                description: None,
                logo_url: None,
                captain_id: Some(2),
                join_password_hash: None,
                status: 1,
                credit_score: DEFAULT_TEAM_CREDIT_SCORE,
                vip_until: None,
                created_at: now,
                updated_at: now,
            })
            .await
            .expect("create team b");

        let service = TeamService::new(
            repository.clone(),
            Arc::new(DummyActivityRepository::with_activity(activity)),
        );
        let updated = service
            .submit_activity_review(
                &TeamPrincipal::user(1),
                "team-a",
                SubmitActivityReviewCommand {
                    activity_id: "activity-1".to_string(),
                    reviewer_team_id: "team-a".to_string(),
                    rating: 4,
                    comment: Some("到场准时".to_string()),
                },
            )
            .await
            .expect("submit activity review");

        assert_eq!(updated.team.id, "team-b");
        assert_eq!(updated.team.credit_score, 66);
        assert_eq!(
            repository
                .list_credit_transactions("team-b", 10)
                .await
                .expect("list transactions")
                .len(),
            1
        );
    }

    #[tokio::test]
    async fn captain_can_recharge_membership_and_extend_vip() {
        let repository = Arc::new(FakeTeamRepository::default());
        let now = Utc::now().naive_utc();

        repository
            .create(&Team {
                id: "team-a".to_string(),
                name: "A".to_string(),
                description: None,
                logo_url: None,
                captain_id: Some(1),
                join_password_hash: None,
                status: 1,
                credit_score: 48,
                vip_until: None,
                created_at: now,
                updated_at: now,
            })
            .await
            .expect("create team a");

        let service = TeamService::new(
            repository.clone(),
            Arc::new(DummyActivityRepository {
                activities: Mutex::new(HashMap::new()),
            }),
        );
        let updated = service
            .recharge_membership(
                &TeamPrincipal::user(1),
                "team-a",
                TeamMembershipRechargeCommand {
                    months: 2,
                    note: Some("补充信用".to_string()),
                },
            )
            .await
            .expect("recharge membership");

        assert_eq!(updated.team.credit_score, 60);
        assert!(updated.team.vip_until.is_some());
        assert!(updated.is_vip);
    }

    #[tokio::test]
    async fn admin_can_apply_credit_penalty() {
        let repository = Arc::new(FakeTeamRepository::default());
        let now = Utc::now().naive_utc();

        repository
            .create(&Team {
                id: "team-a".to_string(),
                name: "A".to_string(),
                description: None,
                logo_url: None,
                captain_id: Some(1),
                join_password_hash: None,
                status: 1,
                credit_score: 72,
                vip_until: None,
                created_at: now,
                updated_at: now,
            })
            .await
            .expect("create team a");

        let service = TeamService::new(
            repository,
            Arc::new(DummyActivityRepository {
                activities: Mutex::new(HashMap::new()),
            }),
        );
        let updated = service
            .apply_credit_penalty(
                &TeamPrincipal::admin(99, true),
                "team-a",
                TeamCreditPenaltyCommand {
                    points: 18,
                    reason: "临时放鸽子".to_string(),
                },
            )
            .await
            .expect("apply credit penalty");

        assert_eq!(updated.team.credit_score, 54);
        assert_eq!(updated.trust_label, "风险较高");
    }
}
