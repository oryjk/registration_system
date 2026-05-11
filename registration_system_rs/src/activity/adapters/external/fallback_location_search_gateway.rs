use crate::activity::ports::{LocationSearchGateway, LocationSearchResult};
use async_trait::async_trait;
use std::sync::Arc;

#[derive(Clone)]
pub struct FallbackLocationSearchGateway {
    gateways: Vec<Arc<dyn LocationSearchGateway>>,
}

impl FallbackLocationSearchGateway {
    pub fn new(gateways: Vec<Arc<dyn LocationSearchGateway>>) -> Self {
        Self { gateways }
    }
}

#[async_trait]
impl LocationSearchGateway for FallbackLocationSearchGateway {
    async fn search_locations(
        &self,
        keyword: &str,
        limit: u8,
    ) -> Result<Vec<LocationSearchResult>, String> {
        let mut errors = Vec::new();

        for gateway in &self.gateways {
            match gateway.search_locations(keyword, limit).await {
                Ok(results) if !results.is_empty() => return Ok(results),
                Ok(_) => errors.push("地点搜索未返回结果".to_string()),
                Err(error) => errors.push(error),
            }
        }

        if errors.is_empty() {
            Ok(Vec::new())
        } else {
            Err(errors.join("；"))
        }
    }

    async fn resolve_location(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<LocationSearchResult, String> {
        let mut errors = Vec::new();

        for gateway in &self.gateways {
            match gateway.resolve_location(latitude, longitude).await {
                Ok(result) => return Ok(result),
                Err(error) => errors.push(error),
            }
        }

        Err(errors.join("；"))
    }
}
