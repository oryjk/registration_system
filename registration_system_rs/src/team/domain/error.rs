use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("已是球队成员")]
    AlreadyMember,
    #[error("球队名称已存在")]
    NameAlreadyExists,
    #[error("基础设施错误: {0}")]
    Infrastructure(String),
}
