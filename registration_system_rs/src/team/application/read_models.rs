use crate::team::domain::{
    Team, TeamAdminInfo, TeamAttendanceRankingItem, TeamMember, TeamMemberAttendanceRecord,
    TeamMemberWithInfo,
};

#[derive(Debug, Clone)]
pub struct TeamDetail {
    pub team: Team,
    pub members: Vec<TeamMember>,
}

#[derive(Debug, Clone)]
pub struct TeamMemberAttendance {
    pub records: Vec<TeamMemberAttendanceRecord>,
}

#[derive(Debug, Clone)]
pub struct TeamAttendanceSummary {
    pub my_records: Vec<TeamMemberAttendanceRecord>,
    pub ranking: Vec<TeamAttendanceRankingItem>,
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
