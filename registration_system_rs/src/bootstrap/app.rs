use crate::bootstrap::config::AppConfig;
use crate::bootstrap::modules::router::{AppServices, assemble_api_router, build_app_services};
use crate::openapi::create_openapi_router;
use crate::shared::adapters::JwtTokenService;
use crate::shared::auth::{ActorContext, Claims};
use crate::shared::error::AppError;
use crate::shared::ports::TokenServicePort;
use crate::shared::upload::upload_root_dir;
use axum::Json;
use axum::Router;
use axum::body::{Body, Bytes, to_bytes};
use axum::http::{HeaderMap, Request, header};
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::get;
use serde::Serialize;
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Instant;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

const MAX_LOG_BODY_BYTES: usize = 64 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub token_service: Arc<dyn TokenServicePort>,
    pub services: AppServices,
}

impl AppState {
    pub fn claims(&self, headers: &HeaderMap) -> Result<Claims, AppError> {
        self.token_service
            .decode_token(extract_bearer_token(headers)?)
    }

    pub fn actor(&self, headers: &HeaderMap) -> Result<ActorContext, AppError> {
        Ok(self.claims(headers)?.actor())
    }

    pub fn optional_actor(&self, headers: &HeaderMap) -> Result<Option<ActorContext>, AppError> {
        let Some(value) = headers.get(header::AUTHORIZATION) else {
            return Ok(None);
        };
        let Some(token) = value
            .to_str()
            .ok()
            .and_then(|value| value.strip_prefix("Bearer "))
        else {
            return Ok(None);
        };

        Ok(Some(self.token_service.decode_token(token)?.actor()))
    }
}

fn extract_bearer_token(headers: &HeaderMap) -> Result<&str, AppError> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Debug, Serialize)]
struct VersionResponse {
    name: &'static str,
    version: String,
    environment: String,
}

pub fn build_app(config: &AppConfig, pool: PgPool) -> Router {
    let token_service: Arc<dyn TokenServicePort> = Arc::new(JwtTokenService::new(
        config.auth.jwt_secret.clone(),
        config.auth.jwt_issuer.clone(),
        config.auth.jwt_ttl_seconds,
    ));
    let services = build_app_services(&pool, config, token_service.clone());

    let state = AppState {
        config: config.clone(),
        token_service,
        services,
    };
    spawn_background_tasks(state.services.clone());

    Router::new()
        .route("/health", get(health_handler))
        .route("/api/version", get(version_handler))
        .route("/apid/version", get(version_handler))
        .nest_service("/uploads", ServeDir::new(upload_root_dir()))
        .merge(create_openapi_router())
        .merge(assemble_api_router())
        .layer(CorsLayer::permissive())
        .layer(middleware::from_fn(access_log_middleware))
        .with_state(state)
}

fn spawn_background_tasks(services: AppServices) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            if let Err(error) = services
                .challenge_service
                .process_individual_payments(chrono::Utc::now().naive_utc())
                .await
            {
                tracing::warn!(error = %error, "处理散人约队支付状态失败");
            }
        }
    });
}

pub fn build_test_app(app_version: &str) -> Router {
    let config = AppConfig::for_test(app_version);
    let pool = sqlx::postgres::PgPoolOptions::new()
        .connect_lazy(&config.database.url)
        .expect("测试连接池初始化失败");
    build_app(&config, pool)
}

async fn health_handler() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

async fn version_handler(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Json<VersionResponse> {
    Json(VersionResponse {
        name: "registration_system_backend",
        version: state.config.app.version,
        environment: state.config.app.env,
    })
}

async fn access_log_middleware(req: Request<Body>, next: Next) -> Response {
    let started_at = Instant::now();
    let method = req.method().clone();
    let uri = req.uri().clone();
    let path = uri.path().to_string();
    let query = uri.query().map(redact_query_string).unwrap_or_default();
    let content_type = req
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();

    let (req, body_log) = capture_request_body_for_log(req, &content_type).await;
    let response = next.run(req).await;
    let status = response.status();
    let latency_ms = started_at.elapsed().as_millis();

    tracing::info!(
        target: "access_log",
        method = %method,
        path = %path,
        query = %LogField(&query),
        body = %LogField(&body_log),
        status = status.as_u16(),
        latency_ms,
        "业务请求"
    );

    response
}

async fn capture_request_body_for_log(
    req: Request<Body>,
    content_type: &str,
) -> (Request<Body>, String) {
    if !should_log_request_body(req.method(), content_type, req.headers()) {
        return (req, String::new());
    }

    let (parts, body) = req.into_parts();
    match to_bytes(body, MAX_LOG_BODY_BYTES).await {
        Ok(bytes) => {
            let body_log = format_request_body_for_log(&bytes, content_type);
            (Request::from_parts(parts, Body::from(bytes)), body_log)
        }
        Err(error) => (
            Request::from_parts(parts, Body::empty()),
            format!("<读取请求体失败: {error}>"),
        ),
    }
}

fn should_log_request_body(
    method: &axum::http::Method,
    content_type: &str,
    headers: &HeaderMap,
) -> bool {
    if !matches!(
        *method,
        axum::http::Method::POST
            | axum::http::Method::PUT
            | axum::http::Method::PATCH
            | axum::http::Method::DELETE
    ) {
        return false;
    }

    if content_type.contains("multipart/form-data") {
        return false;
    }

    let content_length = headers
        .get(header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    if content_length > MAX_LOG_BODY_BYTES {
        return false;
    }

    content_type.contains("application/json")
        || content_type.contains("application/x-www-form-urlencoded")
        || content_type.starts_with("text/")
}

fn format_request_body_for_log(bytes: &Bytes, content_type: &str) -> String {
    if bytes.is_empty() {
        return String::new();
    }

    let text = String::from_utf8_lossy(bytes);
    if content_type.contains("application/json") {
        return serde_json::from_str::<Value>(&text)
            .map(|mut value| {
                redact_json_value(&mut value);
                value.to_string()
            })
            .unwrap_or_else(|_| truncate_log_text(&text));
    }

    if content_type.contains("application/x-www-form-urlencoded") {
        return redact_query_string(&text);
    }

    truncate_log_text(&text)
}

fn redact_query_string(query: &str) -> String {
    query
        .split('&')
        .map(|pair| {
            let Some((key, value)) = pair.split_once('=') else {
                return pair.to_string();
            };
            if is_sensitive_key(key) {
                format!("{key}=<redacted>")
            } else {
                format!("{key}={value}")
            }
        })
        .collect::<Vec<_>>()
        .join("&")
}

fn redact_json_value(value: &mut Value) {
    match value {
        Value::Object(map) => {
            for (key, value) in map.iter_mut() {
                if is_sensitive_key(key) {
                    *value = Value::String("<redacted>".to_string());
                } else {
                    redact_json_value(value);
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                redact_json_value(item);
            }
        }
        _ => {}
    }
}

fn is_sensitive_key(key: &str) -> bool {
    let normalized = key.to_ascii_lowercase();
    [
        "authorization",
        "token",
        "access_token",
        "refresh_token",
        "password",
        "secret",
        "session_key",
        "app_secret",
    ]
    .iter()
    .any(|needle| normalized.contains(needle))
}

fn truncate_log_text(value: &str) -> String {
    const MAX_TEXT_CHARS: usize = 2_000;
    if value.chars().count() <= MAX_TEXT_CHARS {
        return value.to_string();
    }
    format!(
        "{}...(truncated)",
        value.chars().take(MAX_TEXT_CHARS).collect::<String>()
    )
}

struct LogField<'a>(&'a str);

impl std::fmt::Display for LogField<'_> {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.0.is_empty() {
            formatter.write_str("-")
        } else {
            formatter.write_str(self.0)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::extract_bearer_token;
    use crate::shared::error::AppError;
    use axum::http::{HeaderMap, HeaderValue};

    #[test]
    fn extract_bearer_token_returns_token_text() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "authorization",
            HeaderValue::from_static("Bearer test-token"),
        );

        let token = extract_bearer_token(&headers).expect("应能解析 Bearer token");

        assert_eq!(token, "test-token");
    }

    #[test]
    fn extract_bearer_token_rejects_missing_header() {
        let headers = HeaderMap::new();

        let error = extract_bearer_token(&headers).expect_err("缺少 token 应失败");

        assert!(matches!(error, AppError::Unauthorized));
    }

    #[test]
    fn extract_bearer_token_rejects_non_bearer_value() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", HeaderValue::from_static("Token abc"));

        let error = extract_bearer_token(&headers).expect_err("非 Bearer token 应失败");

        assert!(matches!(error, AppError::Unauthorized));
    }
}
