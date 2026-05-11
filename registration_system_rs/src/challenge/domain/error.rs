use std::fmt::{Display, Formatter};

#[derive(Debug, Clone)]
pub enum DomainError {
    NotFound(String),
    Conflict(String),
    Validation(String),
    Infrastructure(String),
}

impl Display for DomainError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(message)
            | Self::Conflict(message)
            | Self::Validation(message)
            | Self::Infrastructure(message) => f.write_str(message),
        }
    }
}

impl std::error::Error for DomainError {}
