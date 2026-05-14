use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::system::application::commands::UpdateMapSettingsCommand;
use crate::system::application::permissions::{ensure_admin, ensure_super_admin};
use crate::system::application::read_models::MapPreviewSettings;
use crate::system::domain::MapServiceSettings;
use crate::system::ports::{SystemSettingsCommandRepository, SystemSettingsQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct MapSettingsUseCase {
    query_repository: Arc<dyn SystemSettingsQueryRepository>,
    command_repository: Arc<dyn SystemSettingsCommandRepository>,
    defaults: MapServiceSettings,
}

impl MapSettingsUseCase {
    pub fn new(
        query_repository: Arc<dyn SystemSettingsQueryRepository>,
        command_repository: Arc<dyn SystemSettingsCommandRepository>,
        defaults: MapServiceSettings,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
            defaults: defaults.sanitize(),
        }
    }

    pub async fn get_map_settings(
        &self,
        actor: &ActorContext,
    ) -> Result<MapServiceSettings, AppError> {
        ensure_super_admin(actor)?;
        self.load_settings().await
    }

    pub async fn get_map_preview_settings(
        &self,
        actor: &ActorContext,
    ) -> Result<MapPreviewSettings, AppError> {
        ensure_admin(actor)?;
        let settings = self.load_settings().await?;
        Ok(MapPreviewSettings {
            selected_provider: settings.selected_provider,
            tencent_map_key: settings.tencent.key,
        })
    }

    pub async fn update_map_settings(
        &self,
        actor: &ActorContext,
        command: UpdateMapSettingsCommand,
    ) -> Result<MapServiceSettings, AppError> {
        ensure_super_admin(actor)?;
        let settings = command.settings.sanitize();
        self.command_repository
            .upsert_map_settings(&settings)
            .await
            .map_err(|error| AppError::internal(format!("保存地图设置失败: {error}")))
    }

    async fn load_settings(&self) -> Result<MapServiceSettings, AppError> {
        Ok(self
            .query_repository
            .get_map_settings()
            .await
            .map_err(|error| AppError::internal(format!("读取地图设置失败: {error}")))?
            .unwrap_or_else(|| self.defaults.clone()))
    }
}
