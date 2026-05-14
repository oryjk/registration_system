use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::system::application::permissions::ensure_super_admin;
use crate::system::domain::MiniAppRuntimeConfig;
use crate::system::ports::{SystemSettingsCommandRepository, SystemSettingsQueryRepository};
use std::sync::Arc;

#[derive(Clone)]
pub struct MiniAppRuntimeConfigUseCase {
    query_repository: Arc<dyn SystemSettingsQueryRepository>,
    command_repository: Arc<dyn SystemSettingsCommandRepository>,
}

impl MiniAppRuntimeConfigUseCase {
    pub fn new(
        query_repository: Arc<dyn SystemSettingsQueryRepository>,
        command_repository: Arc<dyn SystemSettingsCommandRepository>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
        }
    }

    pub async fn get_mini_app_runtime_config(&self) -> Result<MiniAppRuntimeConfig, AppError> {
        Ok(self
            .query_repository
            .get_mini_app_runtime_config()
            .await
            .map_err(|error| AppError::internal(format!("读取小程序运行配置失败: {error}")))?
            .unwrap_or_else(MiniAppRuntimeConfig::defaults)
            .sanitize())
    }

    pub async fn update_mini_app_runtime_config(
        &self,
        actor: &ActorContext,
        config: MiniAppRuntimeConfig,
    ) -> Result<MiniAppRuntimeConfig, AppError> {
        ensure_super_admin(actor)?;
        let config = config.sanitize();
        self.command_repository
            .upsert_mini_app_runtime_config(&config)
            .await
            .map_err(|error| AppError::internal(format!("保存小程序运行配置失败: {error}")))
    }
}
