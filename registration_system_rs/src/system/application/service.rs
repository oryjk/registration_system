use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::system::application::commands::UpdateMapSettingsCommand;
use crate::system::application::read_models::MapPreviewSettings;
use crate::system::application::use_cases::{MapSettingsUseCase, MiniAppRuntimeConfigUseCase};
use crate::system::domain::{MapServiceSettings, MiniAppRuntimeConfig};
use crate::system::ports::{SystemSettingsCommandRepository, SystemSettingsQueryRepository};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct SystemSettingsService {
    map_settings_use_case: MapSettingsUseCase,
    mini_app_runtime_config_use_case: MiniAppRuntimeConfigUseCase,
}

impl Default for SystemSettingsService {
    fn default() -> Self {
        Self::new()
    }
}

impl SystemSettingsService {
    pub fn new() -> Self {
        let repository = Arc::new(InMemorySystemSettingsRepository::default());
        Self::with_repository(
            repository.clone(),
            repository,
            MapServiceSettings::defaults(),
        )
    }

    pub fn with_repository(
        query_repository: Arc<dyn SystemSettingsQueryRepository>,
        command_repository: Arc<dyn SystemSettingsCommandRepository>,
        defaults: MapServiceSettings,
    ) -> Self {
        Self {
            map_settings_use_case: MapSettingsUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
                defaults,
            ),
            mini_app_runtime_config_use_case: MiniAppRuntimeConfigUseCase::new(
                query_repository,
                command_repository,
            ),
        }
    }

    pub async fn get_map_settings(
        &self,
        actor: &ActorContext,
    ) -> Result<MapServiceSettings, AppError> {
        self.map_settings_use_case.get_map_settings(actor).await
    }

    pub async fn get_map_preview_settings(
        &self,
        actor: &ActorContext,
    ) -> Result<MapPreviewSettings, AppError> {
        self.map_settings_use_case
            .get_map_preview_settings(actor)
            .await
    }

    pub async fn update_map_settings(
        &self,
        actor: &ActorContext,
        command: UpdateMapSettingsCommand,
    ) -> Result<MapServiceSettings, AppError> {
        self.map_settings_use_case
            .update_map_settings(actor, command)
            .await
    }

    pub async fn get_mini_app_runtime_config(&self) -> Result<MiniAppRuntimeConfig, AppError> {
        self.mini_app_runtime_config_use_case
            .get_mini_app_runtime_config()
            .await
    }

    pub async fn update_mini_app_runtime_config(
        &self,
        actor: &ActorContext,
        config: MiniAppRuntimeConfig,
    ) -> Result<MiniAppRuntimeConfig, AppError> {
        self.mini_app_runtime_config_use_case
            .update_mini_app_runtime_config(actor, config)
            .await
    }
}

#[derive(Default)]
struct InMemorySystemSettingsRepository {
    settings: Arc<RwLock<Option<MapServiceSettings>>>,
    mini_app_runtime_config: Arc<RwLock<Option<MiniAppRuntimeConfig>>>,
}

#[async_trait::async_trait]
impl SystemSettingsQueryRepository for InMemorySystemSettingsRepository {
    async fn get_map_settings(&self) -> Result<Option<MapServiceSettings>, String> {
        Ok(self.settings.read().await.clone())
    }

    async fn get_mini_app_runtime_config(&self) -> Result<Option<MiniAppRuntimeConfig>, String> {
        Ok(self.mini_app_runtime_config.read().await.clone())
    }
}

#[async_trait::async_trait]
impl SystemSettingsCommandRepository for InMemorySystemSettingsRepository {
    async fn upsert_map_settings(
        &self,
        settings: &MapServiceSettings,
    ) -> Result<MapServiceSettings, String> {
        *self.settings.write().await = Some(settings.clone());
        Ok(settings.clone())
    }

    async fn upsert_mini_app_runtime_config(
        &self,
        config: &MiniAppRuntimeConfig,
    ) -> Result<MiniAppRuntimeConfig, String> {
        *self.mini_app_runtime_config.write().await = Some(config.clone());
        Ok(config.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::SystemSettingsService;
    use crate::shared::auth::{ActorContext, ActorKind};
    use crate::system::application::UpdateMapSettingsCommand;
    use crate::system::domain::{
        MapProvider, MapProviderSettings, MapServiceSettings, MiniAppRuntimeConfig,
    };

    fn admin_actor(is_super_admin: bool) -> ActorContext {
        ActorContext {
            id: 1,
            actor_kind: ActorKind::Admin,
            is_super_admin,
        }
    }

    fn sample_command(provider: MapProvider) -> UpdateMapSettingsCommand {
        UpdateMapSettingsCommand {
            settings: MapServiceSettings {
                selected_provider: provider,
                tencent: MapProviderSettings {
                    key: "tencent-key".to_string(),
                    secret: "tencent-secret".to_string(),
                    web_service_base_url: "https://apis.map.qq.com".to_string(),
                },
                amap: MapProviderSettings {
                    key: "amap-key".to_string(),
                    secret: "amap-secret".to_string(),
                    web_service_base_url: "https://restapi.amap.com".to_string(),
                },
            },
        }
    }

    #[tokio::test]
    async fn returns_tencent_as_default_provider_when_no_settings_saved() {
        let service = SystemSettingsService::new();

        let settings = service
            .get_map_settings(&admin_actor(true))
            .await
            .expect("super admin should be able to read");

        assert_eq!(settings, MapServiceSettings::defaults());
    }

    #[tokio::test]
    async fn persists_selected_provider_and_credentials() {
        let service = SystemSettingsService::new();
        let expected = sample_command(MapProvider::Amap);

        let saved = service
            .update_map_settings(&admin_actor(true), expected.clone())
            .await
            .expect("super admin should be able to update");
        let fetched = service
            .get_map_settings(&admin_actor(true))
            .await
            .expect("super admin should be able to read");

        assert_eq!(saved.selected_provider, MapProvider::Amap);
        assert_eq!(saved, fetched);
        assert_eq!(saved.tencent.key, "tencent-key");
        assert_eq!(saved.amap.key, "amap-key");
    }

    #[tokio::test]
    async fn admins_can_read_public_map_preview_settings_without_secrets() {
        let service = SystemSettingsService::new();
        service
            .update_map_settings(&admin_actor(true), sample_command(MapProvider::Amap))
            .await
            .expect("super admin should be able to update");

        let preview = service
            .get_map_preview_settings(&admin_actor(false))
            .await
            .expect("admin should be able to read preview settings");

        assert_eq!(preview.selected_provider, MapProvider::Amap);
        assert_eq!(preview.tencent_map_key, "tencent-key");
    }

    #[tokio::test]
    async fn rejects_non_super_admin_updates() {
        let service = SystemSettingsService::new();
        let error = service
            .update_map_settings(&admin_actor(false), sample_command(MapProvider::Tencent))
            .await
            .expect_err("non-super admin should be forbidden");

        assert!(matches!(error, crate::shared::error::AppError::Forbidden));
    }

    #[tokio::test]
    async fn rejects_non_super_admin_from_reading_sensitive_map_settings() {
        let service = SystemSettingsService::new();

        let error = service
            .get_map_settings(&admin_actor(false))
            .await
            .expect_err("non-super admin should not read full settings");

        assert!(matches!(error, crate::shared::error::AppError::Forbidden));
    }

    #[tokio::test]
    async fn returns_default_mini_app_runtime_config_when_no_config_saved() {
        let service = SystemSettingsService::new();

        let config = service
            .get_mini_app_runtime_config()
            .await
            .expect("runtime config should be readable without saved data");

        assert_eq!(config, MiniAppRuntimeConfig::defaults());
        assert_eq!(config.home.match_card_limit, 2);
        assert!(config.home.hide_matches_after_holding_time);
    }

    #[tokio::test]
    async fn super_admin_can_update_mini_app_runtime_config() {
        let service = SystemSettingsService::new();
        let mut expected = MiniAppRuntimeConfig::defaults();
        expected.home.match_card_limit = 4;
        expected.home.challenge_card_limit = 3;
        expected.matches.capacity_extra_slots = 1;
        expected.checkin.default_radius_meters = 300;

        let saved = service
            .update_mini_app_runtime_config(&admin_actor(true), expected.clone())
            .await
            .expect("super admin should be able to update runtime config");
        let fetched = service
            .get_mini_app_runtime_config()
            .await
            .expect("runtime config should be readable after update");

        assert_eq!(saved, expected);
        assert_eq!(fetched, expected);
    }

    #[tokio::test]
    async fn rejects_non_super_admin_from_updating_mini_app_runtime_config() {
        let service = SystemSettingsService::new();

        let error = service
            .update_mini_app_runtime_config(&admin_actor(false), MiniAppRuntimeConfig::defaults())
            .await
            .expect_err("non-super admin should not update runtime config");

        assert!(matches!(error, crate::shared::error::AppError::Forbidden));
    }
}
