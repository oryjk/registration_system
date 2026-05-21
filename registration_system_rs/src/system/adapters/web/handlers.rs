use crate::bootstrap::app::AppState;
use crate::shared::api_response::ApiResponse;
use crate::shared::error::AppError;
use crate::shared::http_error::HttpError;
use crate::shared::upload::{detect_image_extension, save_minio_bytes};
use crate::system::adapters::web::dto::{
    MapPreviewSettingsDto, MapSettingsDto, MiniAppDecorationImageUploadResponse,
    MiniAppRuntimeConfigDto, UpdateMapSettingsRequest,
};
use crate::system::application::permissions::ensure_super_admin;
use crate::system::application::UpdateMapSettingsCommand;
use axum::Json;
use axum::extract::{Multipart, State};
use axum::http::HeaderMap;
use uuid::Uuid;

pub async fn get_map_preview_settings_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<MapPreviewSettingsDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let settings = state
        .services
        .system_settings_service
        .get_map_preview_settings(&actor)
        .await?;

    Ok(Json(ApiResponse::success(MapPreviewSettingsDto::from(
        settings,
    ))))
}

pub async fn get_map_settings_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<MapSettingsDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let settings = state
        .services
        .system_settings_service
        .get_map_settings(&actor)
        .await?;

    Ok(Json(ApiResponse::success(MapSettingsDto::from(settings))))
}

pub async fn update_map_settings_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UpdateMapSettingsRequest>,
) -> Result<Json<ApiResponse<MapSettingsDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let settings = state
        .services
        .system_settings_service
        .update_map_settings(
            &actor,
            UpdateMapSettingsCommand {
                settings: payload.into(),
            },
        )
        .await?;

    Ok(Json(ApiResponse::with_message(
        "地图设置保存成功",
        MapSettingsDto::from(settings),
    )))
}

pub async fn get_mini_app_runtime_config_handler(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<MiniAppRuntimeConfigDto>>, HttpError> {
    let config = state
        .services
        .system_settings_service
        .get_mini_app_runtime_config()
        .await?;

    Ok(Json(ApiResponse::success(MiniAppRuntimeConfigDto::from(
        config,
    ))))
}

pub async fn update_mini_app_runtime_config_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<MiniAppRuntimeConfigDto>,
) -> Result<Json<ApiResponse<MiniAppRuntimeConfigDto>>, HttpError> {
    let actor = state.actor(&headers)?;
    let config = state
        .services
        .system_settings_service
        .update_mini_app_runtime_config(&actor, payload.into())
        .await?;

    Ok(Json(ApiResponse::with_message(
        "小程序运行配置保存成功",
        MiniAppRuntimeConfigDto::from(config),
    )))
}

pub async fn upload_mini_app_decoration_image_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<MiniAppDecorationImageUploadResponse>>, HttpError> {
    let actor = state.actor(&headers)?;
    ensure_super_admin(&actor)?;

    let mut image_bytes = None;
    let mut content_type = None;
    let mut file_name = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|error| AppError::Validation(format!("读取上传内容失败: {error}")))?
    {
        if field.name() != Some("file") || image_bytes.is_some() {
            continue;
        }

        content_type = field.content_type().map(str::to_string);
        file_name = field.file_name().map(str::to_string);
        let bytes = field
            .bytes()
            .await
            .map_err(|error| AppError::Validation(format!("读取装修图片失败: {error}")))?;
        image_bytes = Some(bytes);
        break;
    }

    let image_bytes =
        image_bytes.ok_or_else(|| AppError::Validation("请上传装修图片".to_string()))?;
    if image_bytes.is_empty() {
        return Err(AppError::Validation("装修图片不能为空".to_string()).into());
    }
    if image_bytes.len() > 5 * 1024 * 1024 {
        return Err(AppError::Validation("装修图片不能超过 5MB".to_string()).into());
    }

    let extension = detect_image_extension(content_type.as_deref(), file_name.as_deref())
        .ok_or_else(|| AppError::Validation("装修图片仅支持 jpg/png/webp".to_string()))?;
    let file_name = format!("mini-home-{}.{}", Uuid::new_v4(), extension);
    let object_key = format!("mini-app/home-banners/{file_name}");
    let image_url = save_minio_bytes(
        &state.config,
        &object_key,
        &image_bytes,
        content_type.as_deref(),
    )
    .await?;

    Ok(Json(ApiResponse::with_message(
        "小程序装修图片上传成功",
        MiniAppDecorationImageUploadResponse { image_url },
    )))
}
