use crate::system::domain::{
    MapProvider, MapProviderSettings, MapServiceSettings, MiniAppRuntimeConfig,
};
use crate::system::ports::{SystemSettingsCommandRepository, SystemSettingsQueryRepository};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow)]
struct MapSettingsRow {
    selected_provider: String,
    tencent_key: String,
    tencent_secret: String,
    tencent_web_service_base_url: String,
    amap_key: String,
    amap_secret: String,
    amap_web_service_base_url: String,
    #[allow(dead_code)]
    created_at: NaiveDateTime,
    #[allow(dead_code)]
    updated_at: NaiveDateTime,
}

impl TryFrom<MapSettingsRow> for MapServiceSettings {
    type Error = String;

    fn try_from(value: MapSettingsRow) -> Result<Self, Self::Error> {
        Ok(MapServiceSettings {
            selected_provider: MapProvider::try_from(value.selected_provider.as_str())?,
            tencent: MapProviderSettings {
                key: value.tencent_key,
                secret: value.tencent_secret,
                web_service_base_url: value.tencent_web_service_base_url,
            },
            amap: MapProviderSettings {
                key: value.amap_key,
                secret: value.amap_secret,
                web_service_base_url: value.amap_web_service_base_url,
            },
        }
        .sanitize())
    }
}

#[derive(Clone)]
pub struct PostgresSystemSettingsRepository {
    pool: PgPool,
}

impl PostgresSystemSettingsRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SystemSettingsQueryRepository for PostgresSystemSettingsRepository {
    async fn get_map_settings(&self) -> Result<Option<MapServiceSettings>, String> {
        let row = sqlx::query_as::<_, MapSettingsRow>(
            r#"
            SELECT
                selected_provider,
                tencent_key,
                tencent_secret,
                tencent_web_service_base_url,
                amap_key,
                amap_secret,
                amap_web_service_base_url,
                created_at,
                updated_at
            FROM rs_system_map_settings
            WHERE id = 1
            "#,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        row.map(MapServiceSettings::try_from).transpose()
    }

    async fn get_mini_app_runtime_config(&self) -> Result<Option<MiniAppRuntimeConfig>, String> {
        let row = sqlx::query_scalar::<_, serde_json::Value>(
            r#"
            SELECT config_value
            FROM rs_system_runtime_configs
            WHERE config_key = $1
            "#,
        )
        .bind(MiniAppRuntimeConfig::CONFIG_KEY)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        row.map(serde_json::from_value::<MiniAppRuntimeConfig>)
            .transpose()
            .map(|config| config.map(MiniAppRuntimeConfig::sanitize))
            .map_err(|error| error.to_string())
    }
}

#[async_trait]
impl SystemSettingsCommandRepository for PostgresSystemSettingsRepository {
    async fn upsert_map_settings(
        &self,
        settings: &MapServiceSettings,
    ) -> Result<MapServiceSettings, String> {
        let row = sqlx::query_as::<_, MapSettingsRow>(
            r#"
            INSERT INTO rs_system_map_settings (
                id,
                selected_provider,
                tencent_key,
                tencent_secret,
                tencent_web_service_base_url,
                amap_key,
                amap_secret,
                amap_web_service_base_url,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                selected_provider = EXCLUDED.selected_provider,
                tencent_key = EXCLUDED.tencent_key,
                tencent_secret = EXCLUDED.tencent_secret,
                tencent_web_service_base_url = EXCLUDED.tencent_web_service_base_url,
                amap_key = EXCLUDED.amap_key,
                amap_secret = EXCLUDED.amap_secret,
                amap_web_service_base_url = EXCLUDED.amap_web_service_base_url,
                updated_at = NOW()
            RETURNING
                selected_provider,
                tencent_key,
                tencent_secret,
                tencent_web_service_base_url,
                amap_key,
                amap_secret,
                amap_web_service_base_url,
                created_at,
                updated_at
            "#,
        )
        .bind(1_i16)
        .bind(settings.selected_provider.as_str())
        .bind(&settings.tencent.key)
        .bind(&settings.tencent.secret)
        .bind(&settings.tencent.web_service_base_url)
        .bind(&settings.amap.key)
        .bind(&settings.amap.secret)
        .bind(&settings.amap.web_service_base_url)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        MapServiceSettings::try_from(row)
    }

    async fn upsert_mini_app_runtime_config(
        &self,
        config: &MiniAppRuntimeConfig,
    ) -> Result<MiniAppRuntimeConfig, String> {
        let sanitized = config.clone().sanitize();
        let config_value = serde_json::to_value(&sanitized).map_err(|error| error.to_string())?;
        let saved_value = sqlx::query_scalar::<_, serde_json::Value>(
            r#"
            INSERT INTO rs_system_runtime_configs (
                config_key,
                config_value,
                created_at,
                updated_at
            )
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (config_key) DO UPDATE SET
                config_value = EXCLUDED.config_value,
                updated_at = NOW()
            RETURNING config_value
            "#,
        )
        .bind(MiniAppRuntimeConfig::CONFIG_KEY)
        .bind(config_value)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        serde_json::from_value::<MiniAppRuntimeConfig>(saved_value)
            .map(MiniAppRuntimeConfig::sanitize)
            .map_err(|error| error.to_string())
    }
}
