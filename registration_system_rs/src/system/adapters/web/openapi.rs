#![allow(dead_code)]

use super::dto::{
    MapPreviewSettingsDto, MapProviderDto, MapProviderSettingsDto, MapSettingsDto,
    MiniAppDecorationImageUploadResponse, MiniAppRuntimeConfigDto, UpdateMapSettingsRequest,
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

#[utoipa::path(
    get,
    path = "/mini-app-runtime-config",
    tag = "System",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "查询小程序运行配置成功", body = ApiResponse<MiniAppRuntimeConfigDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn get_mini_app_runtime_config_doc() {}

#[utoipa::path(
    patch,
    path = "/mini-app-runtime-config",
    tag = "System",
    security(("bearer_auth" = [])),
    request_body = MiniAppRuntimeConfigDto,
    responses(
        (status = 200, description = "更新小程序运行配置成功", body = ApiResponse<MiniAppRuntimeConfigDto>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn update_mini_app_runtime_config_doc() {}

#[utoipa::path(
    post,
    path = "/mini-app-decoration/images",
    tag = "System",
    security(("bearer_auth" = [])),
    request_body(content = String, content_type = "multipart/form-data"),
    responses(
        (status = 200, description = "上传小程序装修图片成功", body = ApiResponse<MiniAppDecorationImageUploadResponse>),
        (status = 401, description = "未授权", body = ApiResponse<EmptyData>)
    )
)]
fn upload_mini_app_decoration_image_doc() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        get_map_preview_settings_doc,
        get_map_settings_doc,
        update_map_settings_doc,
        get_mini_app_runtime_config_doc,
        update_mini_app_runtime_config_doc,
        upload_mini_app_decoration_image_doc
    ),
    components(
        schemas(
            ApiResponse<MapPreviewSettingsDto>,
            ApiResponse<MapSettingsDto>,
            ApiResponse<MiniAppRuntimeConfigDto>,
            ApiResponse<MiniAppDecorationImageUploadResponse>,
            ApiResponse<EmptyData>,
            EmptyData,
            MapPreviewSettingsDto,
            MapSettingsDto,
            MiniAppRuntimeConfigDto,
            MiniAppDecorationImageUploadResponse,
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
