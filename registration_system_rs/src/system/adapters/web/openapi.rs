#![allow(dead_code)]

use super::dto::{
    MapPreviewSettingsDto, MapProviderDto, MapProviderSettingsDto, MapSettingsDto,
    UpdateMapSettingsRequest,
};
use crate::shared::api_response::{ApiResponse, EmptyData};
use crate::shared::openapi::BearerSecurityAddon;
use utoipa::OpenApi;

#[utoipa::path(
    get,
    path = "/map-preview-settings",
    tag = "System",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "查询地图预览设置成功", body = ApiResponse<MapPreviewSettingsDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_map_preview_settings_doc() {}

#[utoipa::path(
    get,
    path = "/map-settings",
    tag = "System",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "查询地图设置成功", body = ApiResponse<MapSettingsDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_map_settings_doc() {}

#[utoipa::path(
    patch,
    path = "/map-settings",
    tag = "System",
    security(("bearer_auth" = [])),
    request_body = UpdateMapSettingsRequest,
    responses(
        (status = 200, description = "更新地图设置成功", body = ApiResponse<MapSettingsDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_map_settings_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        get_map_preview_settings_doc,
        get_map_settings_doc,
        update_map_settings_doc
    ),
    components(
        schemas(
            ApiResponse<MapPreviewSettingsDto>,
            ApiResponse<MapSettingsDto>,
            ApiResponse<EmptyData>,
            EmptyData,
            MapPreviewSettingsDto,
            MapSettingsDto,
            UpdateMapSettingsRequest,
            MapProviderDto,
            MapProviderSettingsDto
        )
    ),
    tags(
        (name = "System", description = "系统配置与地图服务设置")
    ),
    modifiers(&BearerSecurityAddon)
)]
pub struct SystemApiDoc;
