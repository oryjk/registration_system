use crate::bootstrap::app::AppState;
use crate::shared::api_response::ApiResponse;
use crate::shared::http_error::HttpError;
use crate::system::adapters::web::dto::{
    MapPreviewSettingsDto, MapSettingsDto, MiniAppRuntimeConfigDto, UpdateMapSettingsRequest,
};
use crate::system::application::UpdateMapSettingsCommand;
use axum::Json;
use axum::extract::State;
use axum::http::HeaderMap;

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
