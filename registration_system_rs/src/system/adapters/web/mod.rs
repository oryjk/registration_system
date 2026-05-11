mod dto;
mod handlers;
mod openapi;
mod routes;

pub use openapi::SystemApiDoc;
pub use routes::{create_admin_router, create_app_router};
