use crate::activity::ports::{LocationSearchGateway, LocationSearchResult};
use async_trait::async_trait;
use md5;
use reqwest::Client;
use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct TencentLocationSearchGateway {
    client: Client,
    base_url: String,
    key: String,
    secret: String,
}

#[derive(Debug, Deserialize)]
struct TencentPlaceSearchResponse {
    status: i32,
    message: String,
    #[serde(default)]
    data: Vec<TencentPlaceSearchItem>,
}

#[derive(Debug, Deserialize)]
struct TencentPlaceSearchItem {
    id: String,
    title: String,
    address: String,
    location: TencentLocation,
}

#[derive(Debug, Deserialize)]
struct TencentLocation {
    lat: f64,
    lng: f64,
}

impl TencentLocationSearchGateway {
    pub fn new(base_url: String, key: String, secret: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
            key,
            secret,
        }
    }

    fn build_sig(&self, keyword: &str, limit: u8) -> String {
        let path = "/ws/place/v1/search";
        let query = format!(
            "boundary={}&key={}&keyword={}&page_size={}",
            "region(全国,0)", self.key, keyword, limit,
        );
        format!(
            "{:x}",
            md5::compute(format!("{path}?{query}{}", self.secret))
        )
    }

    fn build_reverse_sig(&self, latitude: f64, longitude: f64) -> String {
        let path = "/ws/geocoder/v1/";
        let query = format!(
            "get_poi={}&key={}&location={:.6},{:.6}",
            1, self.key, latitude, longitude,
        );
        format!(
            "{:x}",
            md5::compute(format!("{path}?{query}{}", self.secret))
        )
    }
}

#[derive(Debug, Deserialize)]
struct TencentReverseGeocodeResponse {
    status: i32,
    message: String,
    result: Option<TencentReverseGeocodeResult>,
}

#[derive(Debug, Deserialize)]
struct TencentReverseGeocodeResult {
    address: String,
    #[serde(default)]
    formatted_addresses: Option<TencentFormattedAddresses>,
    #[serde(default)]
    pois: Vec<TencentPlaceSearchItem>,
}

#[derive(Debug, Deserialize)]
struct TencentFormattedAddresses {
    #[serde(default)]
    recommend: String,
}

#[async_trait]
impl LocationSearchGateway for TencentLocationSearchGateway {
    async fn search_locations(
        &self,
        keyword: &str,
        limit: u8,
    ) -> Result<Vec<LocationSearchResult>, String> {
        let url = format!("{}/ws/place/v1/search", self.base_url.trim_end_matches('/'));
        let response = self
            .client
            .get(url)
            .query(&[
                ("key", self.key.as_str()),
                ("keyword", keyword),
                ("boundary", "region(全国,0)"),
                ("page_size", &limit.to_string()),
                ("sig", &self.build_sig(keyword, limit)),
            ])
            .send()
            .await
            .map_err(|error| format!("请求腾讯地点搜索失败: {error}"))?;

        if !response.status().is_success() {
            return Err(format!("腾讯地点搜索返回异常状态: {}", response.status()));
        }

        let body: TencentPlaceSearchResponse = response
            .json()
            .await
            .map_err(|error| format!("解析腾讯地点搜索响应失败: {error}"))?;

        if body.status != 0 {
            return Err(format!("腾讯地点搜索失败: {}", body.message));
        }

        Ok(body
            .data
            .into_iter()
            .map(|item| LocationSearchResult {
                provider_place_id: item.id,
                title: item.title.clone(),
                address: item.address.clone(),
                display_name: if item.address.trim().is_empty() {
                    item.title
                } else {
                    format!("{} · {}", item.title, item.address)
                },
                latitude: item.location.lat.to_string(),
                longitude: item.location.lng.to_string(),
            })
            .collect())
    }

    async fn resolve_location(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<LocationSearchResult, String> {
        let url = format!("{}/ws/geocoder/v1/", self.base_url.trim_end_matches('/'));
        let response = self
            .client
            .get(url)
            .query(&[
                ("key", self.key.as_str()),
                ("location", &format!("{latitude:.6},{longitude:.6}")),
                ("get_poi", "1"),
                ("sig", &self.build_reverse_sig(latitude, longitude)),
            ])
            .send()
            .await
            .map_err(|error| format!("请求腾讯逆地址解析失败: {error}"))?;

        if !response.status().is_success() {
            return Err(format!("腾讯逆地址解析返回异常状态: {}", response.status()));
        }

        let body: TencentReverseGeocodeResponse = response
            .json()
            .await
            .map_err(|error| format!("解析腾讯逆地址解析响应失败: {error}"))?;

        if body.status != 0 {
            return Err(format!("腾讯逆地址解析失败: {}", body.message));
        }

        let result = body
            .result
            .ok_or_else(|| "腾讯逆地址解析未返回结果".to_string())?;

        if let Some(poi) = result.pois.into_iter().next() {
            let address = if poi.address.trim().is_empty() {
                result.address.clone()
            } else {
                poi.address.clone()
            };

            return Ok(LocationSearchResult {
                provider_place_id: poi.id,
                title: poi.title.clone(),
                address: address.clone(),
                display_name: if address.trim().is_empty() {
                    poi.title
                } else {
                    format!("{} · {}", poi.title, address)
                },
                latitude: latitude.to_string(),
                longitude: longitude.to_string(),
            });
        }

        let title = result
            .formatted_addresses
            .as_ref()
            .map(|item| item.recommend.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or(result.address.trim())
            .to_string();

        Ok(LocationSearchResult {
            provider_place_id: format!("manual:{latitude:.6},{longitude:.6}"),
            title: title.clone(),
            address: result.address.clone(),
            display_name: if result.address.trim().is_empty() {
                title
            } else {
                format!("{} · {}", title, result.address)
            },
            latitude: latitude.to_string(),
            longitude: longitude.to_string(),
        })
    }
}
