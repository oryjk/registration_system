use crate::billing::domain::DomainError;
use crate::shared::error::AppError;

pub fn map_billing_domain_error(context: &str, error: DomainError) -> AppError {
    match error {
        DomainError::Validation(message) => AppError::Validation(message),
        DomainError::Conflict(message) => AppError::Conflict(message),
        DomainError::Infrastructure(message) => AppError::internal(format!("{context}: {message}")),
    }
}
