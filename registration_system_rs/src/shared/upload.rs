use crate::bootstrap::config::AppConfig;
use crate::shared::error::AppError;
use aws_config::{BehaviorVersion, Region};
use aws_sdk_s3::{Client, config::Credentials, primitives::ByteStream};
use axum::http::HeaderMap;
use std::path::PathBuf;

pub fn upload_root_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("uploads")
}

pub fn avatar_upload_dir() -> PathBuf {
    upload_root_dir().join("avatars")
}

pub fn team_logo_upload_dir() -> PathBuf {
    upload_root_dir().join("team-logos")
}

pub fn build_public_upload_url(
    config: &AppConfig,
    headers: &HeaderMap,
    relative_path: &str,
) -> String {
    let base_url = resolve_public_base_url(config, headers);
    format!(
        "{}/{}",
        base_url.trim_end_matches('/'),
        relative_path.trim_start_matches('/')
    )
}

pub fn detect_image_extension(
    content_type: Option<&str>,
    file_name: Option<&str>,
) -> Option<&'static str> {
    match content_type.unwrap_or_default() {
        "image/jpeg" | "image/jpg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/webp" => Some("webp"),
        _ => file_name.and_then(|name| {
            let lower_name = name.to_ascii_lowercase();
            if lower_name.ends_with(".jpg") || lower_name.ends_with(".jpeg") {
                Some("jpg")
            } else if lower_name.ends_with(".png") {
                Some("png")
            } else if lower_name.ends_with(".webp") {
                Some("webp")
            } else {
                None
            }
        }),
    }
}

pub async fn save_upload_bytes(
    config: &AppConfig,
    headers: &HeaderMap,
    local_dir: PathBuf,
    local_relative_prefix: &str,
    object_key: &str,
    bytes: &[u8],
) -> Result<String, AppError> {
    if config
        .upload
        .storage_backend
        .trim()
        .eq_ignore_ascii_case("minio")
    {
        return save_to_minio(config, object_key, bytes).await;
    }

    tokio::fs::create_dir_all(&local_dir)
        .await
        .map_err(|error| AppError::internal(format!("创建上传目录失败: {error}")))?;

    let file_name = object_key
        .rsplit('/')
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::internal("上传文件名无效"))?;
    let file_path = local_dir.join(file_name);
    tokio::fs::write(&file_path, bytes)
        .await
        .map_err(|error| AppError::internal(format!("保存上传文件失败: {error}")))?;

    Ok(build_public_upload_url(
        config,
        headers,
        &format!(
            "/uploads/{}/{}",
            local_relative_prefix.trim_matches('/'),
            file_name
        ),
    ))
}

async fn save_to_minio(
    config: &AppConfig,
    object_key: &str,
    bytes: &[u8],
) -> Result<String, AppError> {
    let credentials = Credentials::new(
        config.upload.minio_access_key.clone(),
        config.upload.minio_secret_key.clone(),
        None,
        None,
        "minio",
    );
    let shared_config = aws_config::defaults(BehaviorVersion::latest())
        .credentials_provider(credentials)
        .endpoint_url(config.upload.minio_endpoint.clone())
        .region(Region::new(config.upload.minio_region.clone()))
        .load()
        .await;
    let s3_config = aws_sdk_s3::config::Builder::from(&shared_config)
        .force_path_style(true)
        .build();
    let client = Client::from_conf(s3_config);

    client
        .put_object()
        .bucket(&config.upload.minio_bucket)
        .key(object_key.trim_start_matches('/'))
        .body(ByteStream::from(bytes.to_vec()))
        .send()
        .await
        .map_err(|error| AppError::internal(format!("上传 MinIO 失败: {error}")))?;

    Ok(format!(
        "{}/{}",
        config.upload.minio_public_url_prefix.trim_end_matches('/'),
        object_key.trim_start_matches('/')
    ))
}

fn resolve_public_base_url(config: &AppConfig, headers: &HeaderMap) -> String {
    let forwarded_proto = headers
        .get("x-forwarded-proto")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let forwarded_host = headers
        .get("x-forwarded-host")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if let Some(host) = forwarded_host.or_else(|| {
        headers
            .get("host")
            .and_then(|value| value.to_str().ok())
            .map(str::trim)
            .filter(|value| !value.is_empty())
    }) {
        let scheme = forwarded_proto.unwrap_or("http");
        return format!("{scheme}://{host}");
    }

    config.server.api_base_url.clone()
}

#[cfg(test)]
mod tests {
    use super::build_public_upload_url;
    use crate::bootstrap::config::AppConfig;
    use axum::http::{HeaderMap, HeaderValue};

    #[test]
    fn prefers_forwarded_headers_when_present() {
        let config = AppConfig::for_test("0.1.0");
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        headers.insert(
            "x-forwarded-host",
            HeaderValue::from_static("mini.example.com"),
        );

        let url = build_public_upload_url(&config, &headers, "/uploads/avatars/user.png");

        assert_eq!(url, "https://mini.example.com/uploads/avatars/user.png");
    }

    #[test]
    fn falls_back_to_host_header_for_local_requests() {
        let config = AppConfig::for_test("0.1.0");
        let mut headers = HeaderMap::new();
        headers.insert("host", HeaderValue::from_static("127.0.0.1:8080"));

        let url = build_public_upload_url(&config, &headers, "uploads/avatars/user.png");

        assert_eq!(url, "http://127.0.0.1:8080/uploads/avatars/user.png");
    }
}
