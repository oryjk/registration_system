use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("微信 API 调用失败: {0}")]
    ApiError(String),
    #[error("基础设施错误: {0}")]
    Infrastructure(String),
}
