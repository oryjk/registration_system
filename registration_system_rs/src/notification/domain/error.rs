use std::fmt::{Display, Formatter};

#[derive(Debug, Clone)]
pub enum DomainError {
    Infrastructure(String),
}

impl Display for DomainError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Infrastructure(message) => f.write_str(message),
        }
    }
}

impl std::error::Error for DomainError {}
