use crate::team::application::TeamApplicationError;
use crate::team::application::permission::TeamPermissionChecker;
use crate::team::application::principal::TeamPrincipal;
use crate::team::application::read_models::{TeamAttendanceSummary, TeamMemberAttendance};
use crate::team::ports::TeamQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct TeamAttendanceUseCase {
    query_repository: Arc<dyn TeamQueryRepository>,
    permission_checker: TeamPermissionChecker,
}

impl TeamAttendanceUseCase {
    pub fn new(query_repository: Arc<dyn TeamQueryRepository>) -> Self {
        let permission_checker = TeamPermissionChecker::new(query_repository.clone());
        Self {
            query_repository,
            permission_checker,
        }
    }

    pub async fn get_member_records(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        target_user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<TeamMemberAttendance, TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        self.permission_checker
            .ensure_team_manager(principal, &team)
            .await?;

        if self
            .query_repository
            .get_member_status(team_id, target_user_id)
            .await
            .map_err(|error| TeamApplicationError::internal(format!("检查成员状态失败: {error}")))?
            .is_none()
        {
            return Err(TeamApplicationError::NotFound(
                "该用户不是球队成员".to_string(),
            ));
        }

        let records = self
            .query_repository
            .list_member_attendance_records(team_id, target_user_id, start_date, end_date)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询队员出场记录失败: {error}"))
            })?;

        Ok(TeamMemberAttendance { records })
    }

    pub async fn get_team_summary(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<TeamAttendanceSummary, TeamApplicationError> {
        let team = self.permission_checker.get_team(team_id).await?;
        self.permission_checker
            .ensure_team_member_or_manager(principal, &team)
            .await?;

        let my_records = self
            .query_repository
            .list_member_attendance_records(team_id, principal.id, start_date, end_date)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询我的出勤记录失败: {error}"))
            })?;
        let ranking = self
            .query_repository
            .list_team_attendance_ranking(team_id, start_date, end_date)
            .await
            .map_err(|error| {
                TeamApplicationError::internal(format!("查询球队出勤排名失败: {error}"))
            })?;

        Ok(TeamAttendanceSummary {
            my_records,
            ranking,
        })
    }
}
