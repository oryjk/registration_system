use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum TeamApplicationError {
    #[error("未认证")]
    Unauthorized,
    #[error("无权限访问")]
    Forbidden,
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    Internal(String),
}

impl TeamApplicationError {
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal(message.into())
    }
}
