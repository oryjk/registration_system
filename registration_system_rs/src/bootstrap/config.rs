use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub app: AppMetadataConfig,
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub auth: AuthConfig,
    pub map: MapConfig,
    pub wx: WechatConfig,
    pub wx_pay: WechatPayConfig,
    pub upload: UploadConfig,
}

#[derive(Debug, Clone)]
pub struct AppMetadataConfig {
    pub env: String,
    pub version: String,
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub api_base_url: String,
}

#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub url: String,
}

#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub jwt_issuer: String,
    pub jwt_ttl_seconds: i64,
}

#[derive(Debug, Clone)]
pub struct MapConfig {
    pub tencent_map_key: String,
    pub tencent_map_secret: String,
    pub tencent_map_web_service_base_url: String,
    pub amap_web_key: String,
    pub amap_web_secret: String,
    pub amap_web_service_base_url: String,
}

#[derive(Debug, Clone)]
pub struct WechatConfig {
    pub app_id: String,
    pub app_secret: String,
    pub use_mock: bool,
    pub mock_phone_number: String,
}

#[derive(Debug, Clone)]
pub struct WechatPayConfig {
    pub mch_id: String,
    pub api_key: String,
    pub api_base_url: String,
    pub notify_path: String,
    pub use_mock: bool,
}

#[derive(Debug, Clone)]
pub struct UploadConfig {
    pub storage_backend: String,
    pub minio_endpoint: String,
    pub minio_access_key: String,
    pub minio_secret_key: String,
    pub minio_bucket: String,
    pub minio_region: String,
    pub minio_public_url_prefix: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        let app = AppMetadataConfig {
            env: std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string()),
            version: std::env::var("APP_VERSION").unwrap_or_else(|_| "0.1.0".to_string()),
        };

        let server = ServerConfig {
            host: std::env::var("APP_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: std::env::var("APP_PORT")
                .unwrap_or_else(|_| "18080".to_string())
                .parse()
                .context("APP_PORT 必须是合法端口")?,
            api_base_url: std::env::var("API_BASE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:18080".to_string()),
        };

        let database = DatabaseConfig {
            url: std::env::var("DATABASE_URL").context("DATABASE_URL 未设置")?,
        };

        let auth = AuthConfig {
            jwt_secret: std::env::var("JWT_SECRET").context("JWT_SECRET 未设置")?,
            jwt_issuer: std::env::var("JWT_ISSUER")
                .unwrap_or_else(|_| "registration-system".to_string()),
            jwt_ttl_seconds: std::env::var("JWT_TTL_SECONDS")
                .unwrap_or_else(|_| "7200".to_string())
                .parse()
                .context("JWT_TTL_SECONDS 必须是整数")?,
        };

        let map = MapConfig {
            tencent_map_key: std::env::var("TENCENT_MAP_KEY").unwrap_or_default(),
            tencent_map_secret: std::env::var("TENCENT_MAP_SECRET").unwrap_or_default(),
            tencent_map_web_service_base_url: std::env::var("TENCENT_MAP_WEB_SERVICE_BASE_URL")
                .unwrap_or_else(|_| "https://apis.map.qq.com".to_string()),
            amap_web_key: std::env::var("AMAP_WEB_KEY").unwrap_or_default(),
            amap_web_secret: std::env::var("AMAP_WEB_SECRET").unwrap_or_default(),
            amap_web_service_base_url: std::env::var("AMAP_WEB_SERVICE_BASE_URL")
                .unwrap_or_else(|_| "https://restapi.amap.com".to_string()),
        };

        let wx = WechatConfig {
            app_id: std::env::var("WX_APP_ID").unwrap_or_default(),
            app_secret: std::env::var("WX_APP_SECRET").unwrap_or_default(),
            use_mock: std::env::var("WX_USE_MOCK")
                .unwrap_or_else(|_| "true".to_string())
                .parse::<bool>()
                .unwrap_or(true),
            mock_phone_number: std::env::var("WX_MOCK_PHONE_NUMBER")
                .unwrap_or_else(|_| "13800138000".to_string()),
        };

        let wx_pay = WechatPayConfig {
            mch_id: std::env::var("WX_MCH_ID").unwrap_or_default(),
            api_key: std::env::var("WX_API_KEY").unwrap_or_default(),
            api_base_url: std::env::var("WX_PAY_API_BASE_URL")
                .unwrap_or_else(|_| "https://api.mch.weixin.qq.com".to_string()),
            notify_path: std::env::var("WX_PAY_NOTIFY_PATH")
                .unwrap_or_else(|_| "/api/payment/wx-notify".to_string()),
            use_mock: std::env::var("WX_PAY_USE_MOCK")
                .unwrap_or_else(|_| "true".to_string())
                .parse::<bool>()
                .unwrap_or(true),
        };

        let upload = UploadConfig {
            storage_backend: std::env::var("UPLOAD_STORAGE_BACKEND")
                .unwrap_or_else(|_| "local".to_string()),
            minio_endpoint: std::env::var("UPLOAD_MINIO_ENDPOINT")
                .unwrap_or_else(|_| "http://127.0.0.1:9000".to_string()),
            minio_access_key: std::env::var("UPLOAD_MINIO_ACCESS_KEY")
                .unwrap_or_else(|_| "minioadmin".to_string()),
            minio_secret_key: std::env::var("UPLOAD_MINIO_SECRET_KEY")
                .unwrap_or_else(|_| "minioadmin123".to_string()),
            minio_bucket: std::env::var("UPLOAD_MINIO_BUCKET")
                .unwrap_or_else(|_| "registration".to_string()),
            minio_region: std::env::var("UPLOAD_MINIO_REGION")
                .unwrap_or_else(|_| "us-east-1".to_string()),
            minio_public_url_prefix: std::env::var("UPLOAD_MINIO_PUBLIC_URL_PREFIX")
                .unwrap_or_else(|_| "http://127.0.0.1:9000/registration".to_string()),
        };

        Ok(Self {
            app,
            server,
            database,
            auth,
            map,
            wx,
            wx_pay,
            upload,
        })
    }

    pub fn for_test(app_version: impl Into<String>) -> Self {
        Self {
            app: AppMetadataConfig {
                env: "test".to_string(),
                version: app_version.into(),
            },
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 18080,
                api_base_url: "http://127.0.0.1:18080".to_string(),
            },
            database: DatabaseConfig {
                url: "postgresql://postgres:password@127.0.0.1:5432/registration_system"
                    .to_string(),
            },
            auth: AuthConfig {
                jwt_secret: "test-secret".to_string(),
                jwt_issuer: "registration-system-test".to_string(),
                jwt_ttl_seconds: 7200,
            },
            map: MapConfig {
                tencent_map_key: String::new(),
                tencent_map_secret: String::new(),
                tencent_map_web_service_base_url: "https://apis.map.qq.com".to_string(),
                amap_web_key: String::new(),
                amap_web_secret: String::new(),
                amap_web_service_base_url: "https://restapi.amap.com".to_string(),
            },
            wx: WechatConfig {
                app_id: "test-app-id".to_string(),
                app_secret: "test-app-secret".to_string(),
                use_mock: true,
                mock_phone_number: "13800138000".to_string(),
            },
            wx_pay: WechatPayConfig {
                mch_id: String::new(),
                api_key: String::new(),
                api_base_url: "https://api.mch.weixin.qq.com".to_string(),
                notify_path: "/api/payment/wx-notify".to_string(),
                use_mock: true,
            },
            upload: UploadConfig {
                storage_backend: "local".to_string(),
                minio_endpoint: "http://127.0.0.1:9000".to_string(),
                minio_access_key: "minioadmin".to_string(),
                minio_secret_key: "minioadmin123".to_string(),
                minio_bucket: "registration".to_string(),
                minio_region: "us-east-1".to_string(),
                minio_public_url_prefix: "http://127.0.0.1:9000/registration".to_string(),
            },
        }
    }

    pub fn payment_notify_url(&self) -> String {
        format!("{}{}", self.server.api_base_url, self.wx_pay.notify_path)
    }
}
