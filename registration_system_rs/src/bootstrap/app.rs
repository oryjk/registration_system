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
    let business_label = describe_request_business(&method, &path);
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
        business = business_label,
        method = %method,
        path = %path,
        query = %LogField(&query),
        body = %LogField(&body_log),
        status = status.as_u16(),
        latency_ms,
        "{business_label}"
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

fn describe_request_business(method: &axum::http::Method, path: &str) -> &'static str {
    match (method.as_str(), path) {
        (_, "/health") => "健康检查",
        (_, "/api/version" | "/apid/version") => "查询版本信息",
        ("GET", "/api/activity/infos") => "查询活动列表",
        ("GET", "/api/activity/check-ongoing") => "检查进行中的活动",
        ("GET", "/api/activity/location-search") => "搜索活动地点",
        ("GET", "/api/activity/location-resolve") => "解析活动地点",
        ("POST", "/api/activity" | "/api/activity/" | "/api/activity/create") => {
            "创建活动"
        }
        ("GET", "/api/challenges" | "/api/challenges/") => "查询约赛列表",
        ("POST", "/api/challenges" | "/api/challenges/") => "创建约赛",
        ("GET", "/api/teams" | "/api/teams/") => "查询球队列表",
        ("POST", "/api/teams" | "/api/teams/") => "创建球队",
        ("GET", "/api/teams/search") => "搜索球队",
        ("POST", "/api/teams/join") => "申请加入球队",
        ("GET", "/api/teams/my-teams") => "查询我的球队",
        ("POST", "/api/user/login") => "微信登录",
        ("POST", "/api/user/password-login") => "账号密码登录",
        ("POST", "/api/user/verify") => "校验用户登录态",
        ("GET", "/api/user/info") => "查询当前用户资料",
        ("PATCH", "/api/user/info") => "更新当前用户资料",
        ("PATCH", "/api/user/phone") => "绑定手机号",
        ("POST", "/api/user/avatar") => "上传头像",
        ("GET", "/api/user/activities") => "查询我的活动",
        ("GET", "/api/user/attendance") => "查询我的出勤",
        ("GET", "/api/user/attendance-ranking") => "查询出勤排行榜",
        ("GET", "/api/notifications" | "/api/notifications/") => "查询通知列表",
        ("GET", "/api/notifications/unread-count") => "查询未读通知数",
        ("POST", "/api/notifications/read-all") => "全部通知标记已读",
        ("GET", "/api/system/mini-app-runtime-config") => "查询小程序运行配置",
        ("POST", "/api/wx/login") => "微信接口登录",
        ("GET", "/api/wx/getAccessToken") => "获取微信访问令牌",
        ("POST", "/api/wx/getPhoneNumber") => "获取微信手机号",
        ("POST", "/api/admin/auth/login") => "管理员登录",
        ("POST", "/api/admin/auth/verify") => "校验管理员登录态",
        ("POST", "/api/admin/auth/register") => "注册管理员",
        ("POST", "/api/admin/auth/logout") => "管理员退出登录",
        ("GET", "/api/admin/auth/admins") => "查询管理员列表",
        ("GET", "/api/admin/users/players") => "查询球员列表",
        ("POST", "/api/admin/users/players") => "创建球员",
        ("POST", "/api/admin/users/players/role-users") => "创建角色账号",
        ("GET", "/api/admin/teams/admin-list") => "查询后台球队列表",
        ("POST", "/api/admin/teams/admin") => "后台创建球队",
        ("GET", "/api/admin/activities" | "/api/admin/activities/") => "查询后台活动列表",
        ("POST", "/api/admin/activities" | "/api/admin/activities/") => "后台创建活动",
        ("GET", "/api/admin/system/map-preview-settings") => "查询地图预览配置",
        ("GET", "/api/admin/system/map-settings") => "查询地图配置",
        ("PATCH", "/api/admin/system/map-settings") => "更新地图配置",
        ("GET", "/api/admin/system/mini-app-runtime-config") => "查询后台小程序运行配置",
        ("PATCH", "/api/admin/system/mini-app-runtime-config") => "更新小程序运行配置",
        ("POST", "/api/admin/system/mini-app-decoration/images") => "上传小程序装饰图",
        _ => describe_dynamic_request_business(method, path),
    }
}

fn describe_dynamic_request_business(method: &axum::http::Method, path: &str) -> &'static str {
    use axum::http::Method;

    if let Some(suffix) = path.strip_prefix("/api/activity/") {
        return match (method, suffix) {
            (&Method::GET, _) if suffix.ends_with("/users") => "查询活动报名用户",
            (&Method::PATCH, _) if suffix.ends_with("/my-stand") => "更新我的活动身份",
            (&Method::POST, _) if suffix.ends_with("/team-registration") => "报名球队活动",
            (&Method::DELETE, _) if suffix.ends_with("/team-registration") => "取消球队活动报名",
            (&Method::PATCH, _) if suffix.ends_with("/check-in-config") => "更新签到配置",
            (&Method::POST, _) if suffix.ends_with("/check-in") => "提交活动签到",
            (&Method::GET, _) => "查询活动详情",
            (&Method::PATCH, _) => "更新活动",
            _ => "活动接口请求",
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/challenges/") {
        return match (method, suffix) {
            (&Method::POST, _) if suffix.ends_with("/accept") => "接受约赛",
            (&Method::DELETE, _) if suffix.ends_with("/individual-acceptance") => "取消散人应约",
            (&Method::POST, _) if suffix.ends_with("/cancel") => "取消约赛",
            (&Method::GET, _) => "查询约赛详情",
            (&Method::PATCH, _) => "更新约赛",
            _ => "约赛接口请求",
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/teams/") {
        return match (method, suffix) {
            (&Method::GET, _) if suffix.ends_with("/password-info") => "查询球队入队口令信息",
            (&Method::GET, _) if suffix.ends_with("/credit") => "查询球队信用分概览",
            (&Method::GET, _) if suffix.ends_with("/credit/transactions") => "查询球队信用分流水",
            (&Method::POST, _) if suffix.ends_with("/credit/reviews") => "提交球队活动评价",
            (&Method::POST, _) if suffix.ends_with("/credit/membership-recharges") => {
                "球队会员充值"
            }
            (&Method::POST, _) if suffix.ends_with("/credit/penalties") => "球队信用分扣罚",
            (&Method::GET, _) if suffix.ends_with("/attendance-summary") => "查询球队出勤汇总",
            (&Method::POST, _) if suffix.ends_with("/members") => "添加球队成员",
            (&Method::POST, _) if suffix.ends_with("/logo") => "上传球队 Logo",
            (&Method::DELETE, _) if suffix.ends_with("/members/batch") => "批量移除球队成员",
            (&Method::PATCH, _) if suffix.ends_with("/members/batch") => "批量更新球队成员状态",
            (&Method::PATCH, _) if suffix.contains("/members/") => "更新球队成员",
            (&Method::DELETE, _) if suffix.contains("/members/") => "移除球队成员",
            (&Method::GET, _) if suffix.ends_with("/attendance") => "查询成员出勤记录",
            (&Method::GET, _) if suffix.starts_with("users/") && suffix.ends_with("/teams") => {
                "查询用户球队"
            }
            (&Method::GET, _) => "查询球队详情",
            (&Method::PATCH, _) => "更新球队",
            (&Method::DELETE, _) => "删除球队",
            _ => "球队接口请求",
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/user/") {
        return match (method, suffix) {
            (&Method::GET, _) if suffix.starts_with("info/") => "查询用户资料",
            (&Method::GET, _) if suffix.starts_with("activities/") => "查询指定用户活动",
            (&Method::GET, _) if suffix.starts_with("attendance/") => "查询指定用户出勤",
            (&Method::GET, _) if suffix.starts_with("attendance-ranking/") => "查询用户出勤排名",
            (&Method::GET, _) => "用户接口查询",
            (&Method::PATCH, _) => "用户接口更新",
            (&Method::POST, _) => "用户接口提交",
            (&Method::DELETE, _) => "用户接口删除",
            _ => "用户接口请求",
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/admin/activities/") {
        return match (method, suffix) {
            (&Method::DELETE, "batch") => "批量删除活动",
            (&Method::PATCH, _) if suffix.ends_with("/status") => "更新活动状态",
            (&Method::POST, _) if suffix.ends_with("/backfill") => "补录活动",
            (&Method::GET, _) if suffix.ends_with("/registrations") => "查询活动报名详情",
            (&Method::POST, _) if suffix.ends_with("/registrations") => "后台登记活动报名",
            (&Method::PATCH, _) if suffix.ends_with("/registrations/batch") => "批量更新报名身份",
            (&Method::PATCH, _) if suffix.contains("/user/") && suffix.ends_with("/stand") => {
                "更新用户活动身份"
            }
            (&Method::DELETE, _) if suffix.contains("/user/") && suffix.ends_with("/registration") => {
                "删除用户活动报名"
            }
            (&Method::GET, _) => "查询后台活动详情",
            (&Method::PATCH, _) => "后台更新活动",
            _ => "后台活动接口请求",
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/admin/users/") {
        return match (method, suffix) {
            (&Method::PATCH, _) if suffix.contains("/password") => "修改球员密码",
            (&Method::POST, _) if suffix.ends_with("/freeze") => "冻结球员",
            (&Method::POST, _) if suffix.ends_with("/unfreeze") => "解冻球员",
            (&Method::DELETE, _) if suffix.starts_with("venues/") => "移除场地方身份",
            (&Method::GET, _) if suffix.starts_with("players/") => "查询球员详情",
            (&Method::PATCH, _) if suffix.starts_with("players/") => "更新球员资料",
            (&Method::PATCH, _) => "更新用户资料",
            (&Method::DELETE, _) => "删除用户",
            _ => "后台用户接口请求",
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/admin/teams/") {
        return match (method, suffix) {
            (&Method::GET, _) if suffix.ends_with("/admin-detail") => "查询后台球队详情",
            (&Method::GET, _) if suffix.ends_with("/admin-managers") => "查询球队管理员",
            (&Method::POST, _) if suffix.ends_with("/admin-managers") => "分配球队管理员",
            (&Method::DELETE, _) if suffix.contains("/admin-managers/") => "取消球队管理员",
            (&Method::GET, _) => "查询后台球队详情",
            (&Method::PATCH, _) => "后台更新球队",
            (&Method::DELETE, _) => "后台删除球队",
            _ => "后台球队接口请求",
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/account/") {
        return match (method, suffix) {
            (&Method::GET, "balance") => "查询我的余额",
            (&Method::GET, _) if suffix.ends_with("/balance") => "查询用户余额",
            (&Method::POST, "recharge") => "余额充值",
            (&Method::POST, "activity-expense") => "登记活动支出",
            (&Method::POST, "penalty") => "登记罚款",
            (&Method::POST, "calibrate-balance") => "校准余额",
            (&Method::GET, "balance-calibrations") => "查询余额校准记录",
            (&Method::GET, "transactions") => "查询交易流水",
            (&Method::GET, _) if suffix.ends_with("/transactions") => "查询用户交易流水",
            _ => "账户接口请求",
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/order/") {
        return match (method, suffix) {
            (&Method::POST, "activity-fee-snapshots") => "保存活动费用快照",
            (&Method::GET, "activity-fee-snapshots") => "查询活动费用快照列表",
            (&Method::GET, _) if suffix.starts_with("activity-fee-snapshots/") => {
                "查询活动费用快照详情"
            }
            (&Method::GET, _) if suffix.ends_with("/settlement") => "查询活动结算详情",
            (&Method::POST, _) if suffix.ends_with("/settlement") => "结算活动费用",
            (&Method::POST, "fee/auto-calculate") => "自动计算活动费用",
            (&Method::POST, "billing/calculate-penalties") => "计算罚款建议",
            (&Method::GET, "activities/billing") => "查询活动账单列表",
            (&Method::GET, "users/billing") => "查询用户账单列表",
            (&Method::GET, "my-billing-flow") => "查询我的账单流水",
            (&Method::GET, _) if suffix.ends_with("/billing-flow") => "查询用户账单流水",
            _ => "账单接口请求",
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/payment/") {
        return match (method, suffix) {
            (&Method::POST, "recharge") => "创建充值订单",
            (&Method::POST, "team-membership") => "创建球队会员订单",
            (&Method::POST, "challenge-individual") => "创建散人约队订单",
            (&Method::GET, _) if suffix.starts_with("order/") => "查询支付订单状态",
            (&Method::POST, _) if suffix.starts_with("sync/") => "同步支付订单状态",
            (&Method::GET, "orders") => "查询支付订单列表",
            (&Method::POST, "wx-notify") => "处理微信支付回调",
            (&Method::POST, "cancel") => "取消支付订单",
            _ => "支付接口请求",
        };
    }

    if path.starts_with("/api/admin/challenges") || path.starts_with("/api/challenges") {
        return "约赛接口请求";
    }

    if path.starts_with("/api/admin")
        || path.starts_with("/api")
        || path.starts_with("/apid")
    {
        return "接口请求";
    }

    "访问静态资源"
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
    use super::{describe_request_business, extract_bearer_token};
    use crate::shared::error::AppError;
    use axum::http::{HeaderMap, HeaderValue, Method};

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

    #[test]
    fn describe_request_business_returns_precise_labels_for_common_routes() {
        assert_eq!(
            describe_request_business(&Method::GET, "/api/activity/infos"),
            "查询活动列表"
        );
        assert_eq!(
            describe_request_business(&Method::POST, "/api/teams"),
            "创建球队"
        );
        assert_eq!(
            describe_request_business(&Method::POST, "/api/user/password-login"),
            "账号密码登录"
        );
        assert_eq!(
            describe_request_business(&Method::GET, "/api/admin/system/mini-app-runtime-config"),
            "查询后台小程序运行配置"
        );
    }

    #[test]
    fn describe_request_business_handles_dynamic_routes() {
        assert_eq!(
            describe_request_business(&Method::POST, "/api/activity/12/team-registration"),
            "报名球队活动"
        );
        assert_eq!(
            describe_request_business(&Method::DELETE, "/api/admin/activities/12/user/9/registration"),
            "删除用户活动报名"
        );
        assert_eq!(
            describe_request_business(&Method::POST, "/api/teams/5/logo"),
            "上传球队 Logo"
        );
        assert_eq!(
            describe_request_business(&Method::GET, "/uploads/team-logos/a.png"),
            "访问静态资源"
        );
    }
}
