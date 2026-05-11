use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("管理员用户名已存在")]
    AdminAlreadyExists,
    #[error("基础设施错误: {0}")]
    Infrastructure(String),
}
