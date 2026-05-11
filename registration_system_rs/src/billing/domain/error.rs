use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    Conflict(String),
    #[error("基础设施错误: {0}")]
    Infrastructure(String),
}
