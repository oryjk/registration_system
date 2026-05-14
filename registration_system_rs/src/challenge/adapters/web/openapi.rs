#![allow(dead_code)]

use super::dto::{
    AcceptChallengeRequest, ActivityRefDto, ChallengeDetailDto, ChallengeDto,
    ChallengeIndividualParticipantDto, ChallengeListQuery, ChallengeStatusDto, ChallengeSummaryDto,
    CreateChallengeRequest,
};
use crate::shared::api_response::{ApiResponse, EmptyData};
use crate::shared::openapi::BearerSecurityAddon;
use utoipa::OpenApi;

#[utoipa::path(
    post,
    path = "/",
    tag = "Challenge",
    security(("bearer_auth" = [])),
    request_body = CreateChallengeRequest,
    responses(
        (status = 200, description = "发布约队成功", body = ApiResponse<ChallengeDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn create_challenge_doc() {}

#[utoipa::path(
    get,
    path = "/",
    tag = "Challenge",
    security(("bearer_auth" = [])),
    params(ChallengeListQuery),
    responses(
        (status = 200, description = "查询约队列表成功", body = ApiResponse<Vec<ChallengeSummaryDto>>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn list_challenges_doc() {}

#[utoipa::path(
    get,
    path = "/{id}",
    tag = "Challenge",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "约队 ID")
    ),
    responses(
        (status = 200, description = "查询约队详情成功", body = ApiResponse<ChallengeDetailDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>),
        (status = 404, description = "约队不存在", body = ApiResponse<EmptyData>)
    )
)]
fn get_challenge_detail_doc() {}

#[utoipa::path(
    post,
    path = "/{id}/accept",
    tag = "Challenge",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "约队 ID")
    ),
    request_body = AcceptChallengeRequest,
    responses(
        (status = 200, description = "接约成功", body = ApiResponse<ChallengeDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn accept_challenge_doc() {}

#[utoipa::path(
    post,
    path = "/{id}/cancel",
    tag = "Challenge",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "约队 ID")
    ),
    responses(
        (status = 200, description = "取消约队成功", body = ApiResponse<ChallengeDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn cancel_challenge_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        create_challenge_doc,
        list_challenges_doc,
        get_challenge_detail_doc,
        accept_challenge_doc,
        cancel_challenge_doc
    ),
    components(
        schemas(
            ApiResponse<ChallengeDto>,
            ApiResponse<Vec<ChallengeSummaryDto>>,
            ApiResponse<ChallengeDetailDto>,
            ApiResponse<EmptyData>,
            EmptyData,
            CreateChallengeRequest,
            AcceptChallengeRequest,
            ChallengeDto,
            ChallengeSummaryDto,
            ChallengeDetailDto,
            ChallengeIndividualParticipantDto,
            ChallengeStatusDto,
            ActivityRefDto
        )
    ),
    tags(
        (name = "Challenge", description = "约队发布、接约与详情查询")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct ChallengeApiDoc;
