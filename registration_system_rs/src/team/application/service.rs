use crate::activity::ports::ActivityQueryRepository;
use crate::team::application::use_cases::{
    CreateTeamUseCase, GetTeamDetailUseCase, GetUserTeamsUseCase, JoinTeamUseCase,
    ListTeamsUseCase, ManageMemberUseCase, ManageTeamAdminAssignmentUseCase,
    ManageTeamCreditUseCase, ManageTeamUseCase, TeamAttendanceUseCase,
};
use crate::team::ports::{TeamCommandRepository, TeamQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct TeamService {
    create_team_use_case: CreateTeamUseCase,
    attendance_use_case: TeamAttendanceUseCase,
    get_team_detail_use_case: GetTeamDetailUseCase,
    get_user_teams_use_case: GetUserTeamsUseCase,
    join_team_use_case: JoinTeamUseCase,
    list_teams_use_case: ListTeamsUseCase,
    manage_admin_assignment_use_case: ManageTeamAdminAssignmentUseCase,
    manage_credit_use_case: ManageTeamCreditUseCase,
    manage_member_use_case: ManageMemberUseCase,
    manage_team_use_case: ManageTeamUseCase,
}

impl TeamService {
    pub fn new(
        query_repository: Arc<dyn TeamQueryRepository>,
        command_repository: Arc<dyn TeamCommandRepository>,
        activity_repository: Arc<dyn ActivityQueryRepository>,
    ) -> Self {
        let create_team_use_case =
            CreateTeamUseCase::new(query_repository.clone(), command_repository.clone());
        let attendance_use_case = TeamAttendanceUseCase::new(query_repository.clone());
        let get_team_detail_use_case = GetTeamDetailUseCase::new(query_repository.clone());
        let get_user_teams_use_case = GetUserTeamsUseCase::new(query_repository.clone());
        let join_team_use_case =
            JoinTeamUseCase::new(query_repository.clone(), command_repository.clone());
        let list_teams_use_case = ListTeamsUseCase::new(query_repository.clone());
        let manage_admin_assignment_use_case = ManageTeamAdminAssignmentUseCase::new(
            query_repository.clone(),
            command_repository.clone(),
        );
        let manage_credit_use_case = ManageTeamCreditUseCase::new(
            query_repository.clone(),
            command_repository.clone(),
            activity_repository.clone(),
        );
        let manage_member_use_case =
            ManageMemberUseCase::new(query_repository.clone(), command_repository.clone());
        let manage_team_use_case =
            ManageTeamUseCase::new(query_repository.clone(), command_repository.clone());

        Self {
            create_team_use_case,
            attendance_use_case,
            get_team_detail_use_case,
            get_user_teams_use_case,
            join_team_use_case,
            list_teams_use_case,
            manage_admin_assignment_use_case,
            manage_credit_use_case,
            manage_member_use_case,
            manage_team_use_case,
        }
    }
}

mod admin_assignment;
mod attendance;
mod credit;
mod members;
mod teams;

#[cfg(test)]
mod tests;
