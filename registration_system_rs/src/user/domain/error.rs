use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("用户已存在")]
    UserAlreadyExists,
    #[error("基础设施错误: {0}")]
    Infrastructure(String),
}
