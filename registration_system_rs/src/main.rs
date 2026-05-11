use anyhow::Context;
use dotenvy::dotenv;
use registration_system_backend::bootstrap::app::build_app;
use registration_system_backend::bootstrap::config::AppConfig;
use registration_system_backend::bootstrap::infra::create_pg_pool;
use registration_system_backend::bootstrap::logging::init_tracing;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    init_tracing()?;

    let config = AppConfig::from_env()?;
    let pool = create_pg_pool(&config.database.url)
        .await
        .context("初始化 PostgreSQL 连接池失败")?;
    let app = build_app(&config, pool);

    let listener =
        tokio::net::TcpListener::bind((config.server.host.as_str(), config.server.port)).await?;
    tracing::info!(
        env = %config.app.env,
        version = %config.app.version,
        host = %config.server.host,
        port = config.server.port,
        "服务启动成功"
    );
    axum::serve(listener, app).await?;

    Ok(())
}
