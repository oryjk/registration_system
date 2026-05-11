use crate::activity::ports::{LocationSearchGateway, LocationSearchResult};
use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct AmapLocationSearchGateway {
    client: Client,
    base_url: String,
    key: String,
    #[allow(dead_code)]
    secret: String,
}

#[derive(Debug, Deserialize)]
struct AmapPlaceSearchResponse {
    status: String,
    info: String,
    infocode: String,
    #[serde(default)]
    pois: Vec<AmapPoi>,
}

#[derive(Debug, Deserialize)]
struct AmapPoi {
    id: String,
    name: String,
    address: Option<String>,
    pname: Option<String>,
    cityname: Option<String>,
    adname: Option<String>,
    location: String,
}

impl AmapLocationSearchGateway {
    pub fn new(base_url: String, key: String, secret: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
            key,
            secret,
        }
    }
}

#[derive(Debug, Deserialize)]
struct AmapReverseGeocodeResponse {
    status: String,
    info: String,
    infocode: String,
    regeocode: Option<AmapReverseGeocodeResult>,
}

#[derive(Debug, Deserialize)]
struct AmapReverseGeocodeResult {
    formatted_address: String,
    #[serde(default)]
    pois: Vec<AmapReversePoi>,
}

#[derive(Debug, Deserialize)]
struct AmapReversePoi {
    id: String,
    name: String,
    address: Option<String>,
}

#[async_trait]
impl LocationSearchGateway for AmapLocationSearchGateway {
    async fn search_locations(
        &self,
        keyword: &str,
        limit: u8,
    ) -> Result<Vec<LocationSearchResult>, String> {
        let url = format!("{}/v3/place/text", self.base_url.trim_end_matches('/'));
        let response = self
            .client
            .get(url)
            .query(&[
                ("key", self.key.as_str()),
                ("keywords", keyword),
                ("extensions", "base"),
                ("offset", &limit.to_string()),
                ("page", "1"),
            ])
            .send()
            .await
            .map_err(|error| format!("请求高德地点搜索失败: {error}"))?;

        if !response.status().is_success() {
            return Err(format!("高德地点搜索返回异常状态: {}", response.status()));
        }

        let body: AmapPlaceSearchResponse = response
            .json()
            .await
            .map_err(|error| format!("解析高德地点搜索响应失败: {error}"))?;

        if body.status != "1" {
            return Err(format!(
                "高德地点搜索失败: {} ({})",
                body.info, body.infocode
            ));
        }

        Ok(body
            .pois
            .into_iter()
            .filter_map(|poi| {
                let (longitude, latitude) = poi.location.split_once(',')?;
                let title = poi.name;
                let display_name = [poi.pname, poi.cityname, poi.adname, poi.address]
                    .into_iter()
                    .flatten()
                    .filter(|part| !part.trim().is_empty())
                    .collect::<Vec<_>>()
                    .join(" ");

                Some(LocationSearchResult {
                    provider_place_id: poi.id,
                    title: title.clone(),
                    address: display_name.clone(),
                    display_name: if display_name.is_empty() {
                        title.clone()
                    } else {
                        format!("{} · {}", title, display_name)
                    },
                    latitude: latitude.to_string(),
                    longitude: longitude.to_string(),
                })
            })
            .collect())
    }

    async fn resolve_location(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<LocationSearchResult, String> {
        let url = format!("{}/v3/geocode/regeo", self.base_url.trim_end_matches('/'));
        let response = self
            .client
            .get(url)
            .query(&[
                ("key", self.key.as_str()),
                ("location", &format!("{longitude:.6},{latitude:.6}")),
                ("extensions", "all"),
                ("radius", "250"),
            ])
            .send()
            .await
            .map_err(|error| format!("请求高德逆地址解析失败: {error}"))?;

        if !response.status().is_success() {
            return Err(format!("高德逆地址解析返回异常状态: {}", response.status()));
        }

        let body: AmapReverseGeocodeResponse = response
            .json()
            .await
            .map_err(|error| format!("解析高德逆地址解析响应失败: {error}"))?;

        if body.status != "1" {
            return Err(format!(
                "高德逆地址解析失败: {} ({})",
                body.info, body.infocode
            ));
        }

        let result = body
            .regeocode
            .ok_or_else(|| "高德逆地址解析未返回结果".to_string())?;

        if let Some(poi) = result.pois.into_iter().next() {
            let address = poi
                .address
                .unwrap_or_else(|| result.formatted_address.clone());
            return Ok(LocationSearchResult {
                provider_place_id: poi.id,
                title: poi.name.clone(),
                address: address.clone(),
                display_name: if address.trim().is_empty() {
                    poi.name
                } else {
                    format!("{} · {}", poi.name, address)
                },
                latitude: latitude.to_string(),
                longitude: longitude.to_string(),
            });
        }

        Ok(LocationSearchResult {
            provider_place_id: format!("manual:{latitude:.6},{longitude:.6}"),
            title: result.formatted_address.clone(),
            address: result.formatted_address.clone(),
            display_name: result.formatted_address.clone(),
            latitude: latitude.to_string(),
            longitude: longitude.to_string(),
        })
    }
}
