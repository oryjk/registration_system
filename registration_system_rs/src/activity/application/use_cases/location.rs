use crate::activity::application::error::ActivityApplicationError;
use crate::activity::application::principal::ActivityPrincipal;
use crate::activity::application::validation::validate_location_coordinates;
use crate::activity::ports::{LocationSearchGateway, LocationSearchResult};
use std::sync::Arc;

#[derive(Clone)]
pub struct ActivityLocationUseCase {
    location_search_gateway: Option<Arc<dyn LocationSearchGateway>>,
}

impl ActivityLocationUseCase {
    pub fn new(location_search_gateway: Option<Arc<dyn LocationSearchGateway>>) -> Self {
        Self {
            location_search_gateway,
        }
    }

    pub async fn search_locations(
        &self,
        actor: &ActivityPrincipal,
        keyword: &str,
        limit: u8,
    ) -> Result<Vec<LocationSearchResult>, ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }

        let keyword = keyword.trim();
        if keyword.is_empty() {
            return Err(ActivityApplicationError::Validation(
                "地点关键词不能为空".to_string(),
            ));
        }

        let gateway = self.location_search_gateway.as_ref().ok_or_else(|| {
            ActivityApplicationError::Internal(
                "地点搜索服务未配置，请在后端 .env 中设置 TENCENT_MAP_KEY 或 AMAP_WEB_KEY"
                    .to_string(),
            )
        })?;

        gateway
            .search_locations(keyword, limit.clamp(1, 10))
            .await
            .map_err(ActivityApplicationError::internal)
    }

    pub async fn resolve_location(
        &self,
        actor: &ActivityPrincipal,
        latitude: f64,
        longitude: f64,
    ) -> Result<LocationSearchResult, ActivityApplicationError> {
        let _ = actor;

        let (latitude, longitude) = validate_location_coordinates(Some(latitude), Some(longitude))?;

        let gateway = self.location_search_gateway.as_ref().ok_or_else(|| {
            ActivityApplicationError::Internal(
                "地点搜索服务未配置，请在后端 .env 中设置 TENCENT_MAP_KEY 或 AMAP_WEB_KEY"
                    .to_string(),
            )
        })?;

        gateway
            .resolve_location(
                latitude.expect("validated latitude should exist"),
                longitude.expect("validated longitude should exist"),
            )
            .await
            .map_err(ActivityApplicationError::internal)
    }
}
