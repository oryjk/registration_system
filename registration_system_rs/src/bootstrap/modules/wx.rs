use crate::bootstrap::app::AppState;
use crate::bootstrap::config::AppConfig;
use crate::wx::adapters::{MockWechatApi, RealWechatApi, create_router};
use crate::wx::application::WxService;
use axum::Router;
use std::sync::Arc;

pub fn build_wx_service(app_config: &AppConfig) -> Arc<WxService> {
    let api: Arc<dyn crate::wx::ports::WechatApi> = if app_config.wx.use_mock
        || app_config.wx.app_id.is_empty()
        || app_config.wx.app_secret.is_empty()
    {
        Arc::new(MockWechatApi::new(app_config.wx.mock_phone_number.clone()))
    } else {
        Arc::new(RealWechatApi::new(
            app_config.wx.app_id.clone(),
            app_config.wx.app_secret.clone(),
        ))
    };

    Arc::new(WxService::new(api))
}

pub fn build_wx_router() -> Router<AppState> {
    create_router()
}
