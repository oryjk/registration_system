use crate::system::domain::{MapServiceSettings, MiniAppRuntimeConfig};
use async_trait::async_trait;

#[async_trait]
pub trait SystemSettingsQueryRepository: Send + Sync {
    async fn get_map_settings(&self) -> Result<Option<MapServiceSettings>, String>;
    async fn get_mini_app_runtime_config(&self) -> Result<Option<MiniAppRuntimeConfig>, String>;
}

#[async_trait]
pub trait SystemSettingsCommandRepository: Send + Sync {
    async fn upsert_map_settings(
        &self,
        settings: &MapServiceSettings,
    ) -> Result<MapServiceSettings, String>;
    async fn upsert_mini_app_runtime_config(
        &self,
        config: &MiniAppRuntimeConfig,
    ) -> Result<MiniAppRuntimeConfig, String>;
}
