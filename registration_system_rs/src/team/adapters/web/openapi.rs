#![allow(dead_code)]

use super::dto::{
    AddTeamMemberRequest, AdminCreateTeamRequest, AssignAdminRequest, BatchRemoveMembersRequest,
    BatchUpdateMemberStatusRequest, CreateTeamRequest, JoinTeamRequest,
    SubmitActivityReviewRequest, TeamAdminInfoDto, TeamCreditOverviewDto, TeamCreditPenaltyRequest,
    TeamCreditTransactionDto, TeamDetailDto, TeamDetailForAdminDto, TeamDto, TeamMemberDto,
    TeamMemberWithInfoDto, TeamMembershipRechargeRequest, TeamPasswordInfoDto, TeamSummaryDto,
    UpdateTeamMemberRequest, UpdateTeamRequest,
};
use super::handlers::{TeamCreditTransactionsQuery, TeamListQuery, TeamSearchQuery};
use crate::shared::api_response::{ApiResponse, EmptyData};
use crate::shared::openapi::BearerSecurityAddon;
use utoipa::OpenApi;

#[utoipa::path(
    post,
    path = "/",
    tag = "Team",
    security(("bearer_auth" = [])),
    request_body = CreateTeamRequest,
    responses(
        (status = 200, description = "创建球队成功", body = ApiResponse<TeamDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn create_team_doc() {}

#[utoipa::path(
    get,
    path = "/",
    tag = "Team",
    params(TeamListQuery),
    responses(
        (status = 200, description = "查询球队列表成功", body = ApiResponse<Vec<TeamSummaryDto>>)
    )
)]
fn list_teams_doc() {}

#[utoipa::path(
    get,
    path = "/search",
    tag = "Team",
    params(TeamSearchQuery),
    responses(
        (status = 200, description = "搜索球队成功", body = ApiResponse<Vec<TeamSummaryDto>>)
    )
)]
fn search_teams_doc() {}

#[utoipa::path(
    post,
    path = "/join",
    tag = "Team",
    security(("bearer_auth" = [])),
    request_body = JoinTeamRequest,
    responses(
        (status = 200, description = "加入球队成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn join_team_doc() {}

#[utoipa::path(
    get,
    path = "/my-teams",
    tag = "Team",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "查询我的球队成功", body = ApiResponse<Vec<TeamDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn my_teams_doc() {}

#[utoipa::path(
    get,
    path = "/users/{user_id}/teams",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "查询指定用户球队成功", body = ApiResponse<Vec<TeamDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn user_teams_doc() {}

#[utoipa::path(
    get,
    path = "/{id}/password-info",
    tag = "Team",
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    responses(
        (status = 200, description = "获取球队密码信息成功", body = ApiResponse<TeamPasswordInfoDto>)
    )
)]
fn password_info_doc() {}

#[utoipa::path(
    get,
    path = "/{id}/credit",
    tag = "Team",
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    responses(
        (status = 200, description = "获取球队信用概览成功", body = ApiResponse<TeamCreditOverviewDto>)
    )
)]
fn team_credit_overview_doc() {}

#[utoipa::path(
    get,
    path = "/{id}/credit/transactions",
    tag = "Team",
    params(
        TeamCreditTransactionsQuery,
        ("id" = String, Path, description = "球队 ID")
    ),
    responses(
        (status = 200, description = "查询球队信用流水成功", body = ApiResponse<Vec<TeamCreditTransactionDto>>)
    )
)]
fn list_team_credit_transactions_doc() {}

#[utoipa::path(
    post,
    path = "/{id}/credit/reviews",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    request_body = SubmitActivityReviewRequest,
    responses(
        (status = 200, description = "提交赛后评价成功", body = ApiResponse<TeamCreditOverviewDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn submit_activity_review_doc() {}

#[utoipa::path(
    post,
    path = "/{id}/credit/membership-recharges",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    request_body = TeamMembershipRechargeRequest,
    responses(
        (status = 200, description = "球队会员充值成功", body = ApiResponse<TeamCreditOverviewDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn recharge_team_membership_doc() {}

#[utoipa::path(
    post,
    path = "/{id}/credit/penalties",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    request_body = TeamCreditPenaltyRequest,
    responses(
        (status = 200, description = "信用罚扣成功", body = ApiResponse<TeamCreditOverviewDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn team_credit_penalty_doc() {}

#[utoipa::path(
    post,
    path = "/{id}/members",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    request_body = AddTeamMemberRequest,
    responses(
        (status = 200, description = "新增球队成员成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn add_member_doc() {}

#[utoipa::path(
    delete,
    path = "/{id}/members/batch",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    request_body = BatchRemoveMembersRequest,
    responses(
        (status = 200, description = "批量移除队员成功", body = ApiResponse<u64>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn batch_remove_members_doc() {}

#[utoipa::path(
    patch,
    path = "/{id}/members/batch",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    request_body = BatchUpdateMemberStatusRequest,
    responses(
        (status = 200, description = "批量更新成员状态成功", body = ApiResponse<u64>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn batch_update_member_status_doc() {}

#[utoipa::path(
    patch,
    path = "/{id}/members/{user_id}",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID"),
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    request_body = UpdateTeamMemberRequest,
    responses(
        (status = 200, description = "更新成员成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_member_doc() {}

#[utoipa::path(
    delete,
    path = "/{id}/members/{user_id}",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID"),
        ("user_id" = i64, Path, description = "用户 ID")
    ),
    responses(
        (status = 200, description = "移除成员成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn remove_member_doc() {}

#[utoipa::path(
    get,
    path = "/{id}",
    tag = "Team",
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    responses(
        (status = 200, description = "查询球队详情成功", body = ApiResponse<TeamDetailDto>)
    )
)]
fn get_team_doc() {}

#[utoipa::path(
    patch,
    path = "/{id}",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    request_body = UpdateTeamRequest,
    responses(
        (status = 200, description = "更新球队成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_team_doc() {}

#[utoipa::path(
    delete,
    path = "/{id}",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    responses(
        (status = 200, description = "删除球队成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn delete_team_doc() {}

#[utoipa::path(
    post,
    path = "/admin",
    tag = "Team",
    security(("bearer_auth" = [])),
    request_body = AdminCreateTeamRequest,
    responses(
        (status = 200, description = "管理后台创建球队成功", body = ApiResponse<TeamDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn admin_create_team_doc() {}

#[utoipa::path(
    get,
    path = "/admin-list",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(TeamListQuery),
    responses(
        (status = 200, description = "管理后台查询球队列表成功", body = ApiResponse<Vec<TeamSummaryDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn admin_list_teams_doc() {}

#[utoipa::path(
    get,
    path = "/{id}/admin-detail",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    responses(
        (status = 200, description = "管理后台查询球队详情成功", body = ApiResponse<TeamDetailForAdminDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn admin_team_detail_doc() {}

#[utoipa::path(
    get,
    path = "/{id}/admin-managers",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    responses(
        (status = 200, description = "查询球队管理员列表成功", body = ApiResponse<Vec<TeamAdminInfoDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn list_team_admins_doc() {}

#[utoipa::path(
    post,
    path = "/{id}/admin-managers",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID")
    ),
    request_body = AssignAdminRequest,
    responses(
        (status = 200, description = "分配球队管理员成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn assign_admin_doc() {}

#[utoipa::path(
    delete,
    path = "/{id}/admin-managers/{admin_id}",
    tag = "Team",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "球队 ID"),
        ("admin_id" = i64, Path, description = "管理员 ID")
    ),
    responses(
        (status = 200, description = "取消球队管理员分配成功", body = ApiResponse<EmptyData>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn unassign_admin_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        create_team_doc,
        list_teams_doc,
        search_teams_doc,
        join_team_doc,
        my_teams_doc,
        user_teams_doc,
        password_info_doc,
        team_credit_overview_doc,
        list_team_credit_transactions_doc,
        submit_activity_review_doc,
        recharge_team_membership_doc,
        team_credit_penalty_doc,
        add_member_doc,
        batch_remove_members_doc,
        batch_update_member_status_doc,
        update_member_doc,
        remove_member_doc,
        get_team_doc,
        update_team_doc,
        delete_team_doc,
        admin_create_team_doc,
        admin_list_teams_doc,
        admin_team_detail_doc,
        list_team_admins_doc,
        assign_admin_doc,
        unassign_admin_doc
    ),
    components(
        schemas(
            ApiResponse<TeamDto>,
            ApiResponse<Vec<TeamSummaryDto>>,
            ApiResponse<Vec<TeamDto>>,
            ApiResponse<TeamPasswordInfoDto>,
            ApiResponse<TeamCreditOverviewDto>,
            ApiResponse<Vec<TeamCreditTransactionDto>>,
            ApiResponse<TeamDetailDto>,
            ApiResponse<TeamDetailForAdminDto>,
            ApiResponse<Vec<TeamAdminInfoDto>>,
            ApiResponse<u64>,
            ApiResponse<EmptyData>,
            EmptyData,
            CreateTeamRequest,
            AdminCreateTeamRequest,
            JoinTeamRequest,
            UpdateTeamRequest,
            AddTeamMemberRequest,
            UpdateTeamMemberRequest,
            SubmitActivityReviewRequest,
            TeamMembershipRechargeRequest,
            TeamCreditPenaltyRequest,
            AssignAdminRequest,
            BatchRemoveMembersRequest,
            BatchUpdateMemberStatusRequest,
            TeamDto,
            TeamSummaryDto,
            TeamMemberDto,
            TeamDetailDto,
            TeamPasswordInfoDto,
            TeamCreditOverviewDto,
            TeamCreditTransactionDto,
            TeamMemberWithInfoDto,
            TeamDetailForAdminDto,
            TeamAdminInfoDto
        )
    ),
    tags(
        (name = "Team", description = "球队与成员管理")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct TeamApiDoc;
