use crate::activity::adapters::{AmapLocationSearchGateway, TencentLocationSearchGateway};
use crate::activity::ports::{LocationSearchGateway, LocationSearchResult};
use crate::system::domain::{MapProvider, MapServiceSettings};
use crate::system::ports::SystemSettingsRepository;
use async_trait::async_trait;
use std::sync::Arc;

#[derive(Clone)]
pub struct ConfiguredLocationSearchGateway {
    repository: Arc<dyn SystemSettingsRepository>,
    defaults: MapServiceSettings,
}

impl ConfiguredLocationSearchGateway {
    pub fn new(
        repository: Arc<dyn SystemSettingsRepository>,
        defaults: MapServiceSettings,
    ) -> Self {
        Self {
            repository,
            defaults: defaults.sanitize(),
        }
    }

    async fn resolve_settings(&self) -> Result<MapServiceSettings, String> {
        Ok(self
            .repository
            .get_map_settings()
            .await
            .map_err(|error| format!("读取地图设置失败: {error}"))?
            .unwrap_or_else(|| self.defaults.clone()))
    }
}

#[async_trait]
impl LocationSearchGateway for ConfiguredLocationSearchGateway {
    async fn search_locations(
        &self,
        keyword: &str,
        limit: u8,
    ) -> Result<Vec<LocationSearchResult>, String> {
        let settings = self.resolve_settings().await?;

        match settings.selected_provider {
            MapProvider::Tencent => {
                if settings.tencent.key.trim().is_empty()
                    || settings.tencent.secret.trim().is_empty()
                {
                    return Err(
                        "当前地图服务商为腾讯地图，请先在系统设置中填写腾讯地图 Key 和 Secret"
                            .to_string(),
                    );
                }

                TencentLocationSearchGateway::new(
                    settings.tencent.web_service_base_url,
                    settings.tencent.key,
                    settings.tencent.secret,
                )
                .search_locations(keyword, limit)
                .await
            }
            MapProvider::Amap => {
                if settings.amap.key.trim().is_empty() {
                    return Err(
                        "当前地图服务商为高德地图，请先在系统设置中填写高德地图 Key".to_string()
                    );
                }

                AmapLocationSearchGateway::new(
                    settings.amap.web_service_base_url,
                    settings.amap.key,
                    settings.amap.secret,
                )
                .search_locations(keyword, limit)
                .await
            }
        }
    }

    async fn resolve_location(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<LocationSearchResult, String> {
        let settings = self.resolve_settings().await?;

        match settings.selected_provider {
            MapProvider::Tencent => {
                if settings.tencent.key.trim().is_empty()
                    || settings.tencent.secret.trim().is_empty()
                {
                    return Err(
                        "当前地图服务商为腾讯地图，请先在系统设置中填写腾讯地图 Key 和 Secret"
                            .to_string(),
                    );
                }

                TencentLocationSearchGateway::new(
                    settings.tencent.web_service_base_url,
                    settings.tencent.key,
                    settings.tencent.secret,
                )
                .resolve_location(latitude, longitude)
                .await
            }
            MapProvider::Amap => {
                if settings.amap.key.trim().is_empty() {
                    return Err(
                        "当前地图服务商为高德地图，请先在系统设置中填写高德地图 Key".to_string()
                    );
                }

                AmapLocationSearchGateway::new(
                    settings.amap.web_service_base_url,
                    settings.amap.key,
                    settings.amap.secret,
                )
                .resolve_location(latitude, longitude)
                .await
            }
        }
    }
}
