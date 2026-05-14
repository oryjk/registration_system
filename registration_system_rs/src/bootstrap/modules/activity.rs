use crate::activity::adapters::{
    ConfiguredLocationSearchGateway, PostgresActivityRepository, PostgresActivityTeamAccessPort,
    create_admin_router, create_app_router,
};
use crate::activity::application::ActivityService;
use crate::activity::ports::LocationSearchGateway;
use crate::bootstrap::app::AppState;
use crate::bootstrap::config::AppConfig;
use crate::system::domain::{MapProvider, MapProviderSettings, MapServiceSettings};
use crate::system::ports::SystemSettingsQueryRepository;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

pub fn build_activity_service(
    pool: &PgPool,
    config: &AppConfig,
    settings_repository: Arc<dyn SystemSettingsQueryRepository>,
) -> Arc<ActivityService> {
    let repository = Arc::new(PostgresActivityRepository::new(pool.clone()));
    let team_access_port = Arc::new(PostgresActivityTeamAccessPort::new(pool.clone()));
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
    let location_search_gateway: Arc<dyn LocationSearchGateway> = Arc::new(
        ConfiguredLocationSearchGateway::new(settings_repository, defaults),
    );

    Arc::new(ActivityService::new(
        repository.clone(),
        repository,
        Some(location_search_gateway),
        team_access_port,
    ))
}

pub fn build_admin_activity_router() -> Router<AppState> {
    create_admin_router()
}

pub fn build_app_activity_router() -> Router<AppState> {
    create_app_router()
}
