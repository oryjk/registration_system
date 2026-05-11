use crate::bootstrap::app::AppState;
use crate::bootstrap::config::AppConfig;
use crate::system::adapters::{
    PostgresSystemSettingsRepository, create_admin_router, create_app_router,
};
use crate::system::application::SystemSettingsService;
use crate::system::domain::{MapProvider, MapProviderSettings, MapServiceSettings};
use crate::system::ports::SystemSettingsRepository;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_system_settings_repository(pool: &PgPool) -> Arc<dyn SystemSettingsRepository> {
    Arc::new(PostgresSystemSettingsRepository::new(pool.clone()))
}

pub fn build_system_service(
    repository: Arc<dyn SystemSettingsRepository>,
    config: &AppConfig,
) -> Arc<SystemSettingsService> {
    let defaults = MapServiceSettings {
        selected_provider: MapProvider::Tencent,
        tencent: MapProviderSettings {
            key: config.map.tencent_map_key.clone(),
            secret: config.map.tencent_map_secret.clone(),
            web_service_base_url: config.map.tencent_map_web_service_base_url.clone(),
        },
        amap: MapProviderSettings {
            key: config.map.amap_web_key.clone(),
            secret: config.map.amap_web_secret.clone(),
            web_service_base_url: config.map.amap_web_service_base_url.clone(),
        },
    };

    Arc::new(SystemSettingsService::with_repository(repository, defaults))
}

pub fn build_admin_system_router() -> Router<AppState> {
    create_admin_router()
}

pub fn build_app_system_router() -> Router<AppState> {
    create_app_router()
}
