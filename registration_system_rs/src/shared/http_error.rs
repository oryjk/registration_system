use crate::shared::api_response::ApiResponse;
use crate::shared::error::AppError;
use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

#[derive(Debug)]
pub struct HttpError(pub AppError);

impl From<AppError> for HttpError {
    fn from(value: AppError) -> Self {
        Self(value)
    }
}

impl HttpError {
    fn status_code(error: &AppError) -> StatusCode {
        match error {
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,
            AppError::Forbidden => StatusCode::FORBIDDEN,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_code(error: &AppError) -> &'static str {
        match error {
            AppError::Unauthorized => "AUTH_UNAUTHORIZED",
            AppError::Forbidden => "AUTH_FORBIDDEN",
            AppError::NotFound(_) => "RESOURCE_NOT_FOUND",
            AppError::Conflict(_) => "RESOURCE_CONFLICT",
            AppError::Validation(_) => "VALIDATION_FAILED",
            AppError::Internal(_) => "INTERNAL_ERROR",
        }
    }

    fn error_type(error: &AppError) -> &'static str {
        match error {
            AppError::Unauthorized | AppError::Forbidden => "auth",
            AppError::NotFound(_) => "not_found",
            AppError::Conflict(_) => "conflict",
            AppError::Validation(_) => "validation",
            AppError::Internal(_) => "internal",
        }
    }
}

impl IntoResponse for HttpError {
    fn into_response(self) -> Response {
        let status = Self::status_code(&self.0);
        let error_code = Self::error_code(&self.0);
        let error_type = Self::error_type(&self.0);
        let message = self.0.to_string();

        if status.is_server_error() {
            tracing::error!(status = %status, error_code, error_type, message = %message, "请求处理失败");
        } else {
            tracing::warn!(status = %status, error_code, error_type, message = %message, "请求校验失败");
        }

        let body = ApiResponse::<()>::error(message);
        (status, Json(body)).into_response()
    }
}
