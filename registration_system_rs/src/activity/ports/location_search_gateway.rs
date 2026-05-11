use async_trait::async_trait;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocationSearchResult {
    pub provider_place_id: String,
    pub title: String,
    pub address: String,
    pub display_name: String,
    pub latitude: String,
    pub longitude: String,
}

#[async_trait]
pub trait LocationSearchGateway: Send + Sync {
    async fn search_locations(
        &self,
        keyword: &str,
        limit: u8,
    ) -> Result<Vec<LocationSearchResult>, String>;

    async fn resolve_location(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<LocationSearchResult, String>;
}
