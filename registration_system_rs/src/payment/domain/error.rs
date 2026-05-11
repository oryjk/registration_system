use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("订单号已存在")]
    DuplicateOrder,
    #[error("基础设施错误: {0}")]
    Infrastructure(String),
}
