pub mod api;
pub mod web;

pub use api::{MockWechatApi, RealWechatApi};
pub use web::create_router;
