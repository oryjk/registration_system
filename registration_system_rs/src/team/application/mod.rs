mod commands;
mod error;
mod permission;
mod principal;
mod read_models;
mod service;
mod use_cases;

pub use commands::{
    AddTeamMemberCommand, CreateTeamCommand, SubmitActivityReviewCommand, TeamCreditPenaltyCommand,
    TeamMembershipRechargeCommand, UpdateTeamCommand, UpdateTeamMemberCommand,
};
pub use error::TeamApplicationError;
pub use permission::TeamPermissionChecker;
pub use principal::{TeamPrincipal, TeamRole};
pub use read_models::{
    TeamAttendanceSummary, TeamCreditOverview, TeamDetail, TeamDetailForAdmin,
    TeamMemberAttendance, TeamSummary,
};
pub use service::TeamService;
pub use use_cases::{CreateTeamUseCase, JoinTeamUseCase, ManageMemberUseCase, ManageTeamUseCase};
