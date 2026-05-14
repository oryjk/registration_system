use super::TeamService;
use crate::team::application::read_models::{TeamAttendanceSummary, TeamMemberAttendance};
use crate::team::application::{TeamApplicationError, TeamPrincipal};

impl TeamService {
    pub async fn get_member_attendance_records(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        target_user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<TeamMemberAttendance, TeamApplicationError> {
        self.attendance_use_case
            .get_member_records(principal, team_id, target_user_id, start_date, end_date)
            .await
    }

    pub async fn get_team_attendance_summary(
        &self,
        principal: &TeamPrincipal,
        team_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<TeamAttendanceSummary, TeamApplicationError> {
        self.attendance_use_case
            .get_team_summary(principal, team_id, start_date, end_date)
            .await
    }
}
