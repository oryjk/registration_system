use crate::system::application::{
    MapPreviewSettings, MapProvider, MapProviderSettings, MapServiceSettings,
};
use crate::system::domain::{
    MiniAppBillingRuntimeConfig, MiniAppCheckinRuntimeConfig, MiniAppHomeRuntimeConfig,
    MiniAppMatchesRuntimeConfig, MiniAppNotificationsRuntimeConfig, MiniAppProfileRuntimeConfig,
    MiniAppRuntimeConfig,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum MapProviderDto {
    Tencent,
    Amap,
}

impl From<MapProvider> for MapProviderDto {
    fn from(value: MapProvider) -> Self {
        match value {
            MapProvider::Tencent => Self::Tencent,
            MapProvider::Amap => Self::Amap,
        }
    }
}

impl From<MapProviderDto> for MapProvider {
    fn from(value: MapProviderDto) -> Self {
        match value {
            MapProviderDto::Tencent => Self::Tencent,
            MapProviderDto::Amap => Self::Amap,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MapProviderSettingsDto {
    pub key: String,
    pub secret: String,
    pub web_service_base_url: String,
}

impl From<MapProviderSettings> for MapProviderSettingsDto {
    fn from(value: MapProviderSettings) -> Self {
        Self {
            key: value.key,
            secret: value.secret,
            web_service_base_url: value.web_service_base_url,
        }
    }
}

impl From<MapProviderSettingsDto> for MapProviderSettings {
    fn from(value: MapProviderSettingsDto) -> Self {
        Self {
            key: value.key,
            secret: value.secret,
            web_service_base_url: value.web_service_base_url,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MapSettingsDto {
    pub selected_provider: MapProviderDto,
    pub tencent: MapProviderSettingsDto,
    pub amap: MapProviderSettingsDto,
}

impl From<MapServiceSettings> for MapSettingsDto {
    fn from(value: MapServiceSettings) -> Self {
        Self {
            selected_provider: value.selected_provider.into(),
            tencent: value.tencent.into(),
            amap: value.amap.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MapPreviewSettingsDto {
    pub selected_provider: MapProviderDto,
    pub tencent_map_key: String,
}

impl From<MapPreviewSettings> for MapPreviewSettingsDto {
    fn from(value: MapPreviewSettings) -> Self {
        Self {
            selected_provider: value.selected_provider.into(),
            tencent_map_key: value.tencent_map_key,
        }
    }
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateMapSettingsRequest {
    pub selected_provider: MapProviderDto,
    pub tencent: MapProviderSettingsDto,
    pub amap: MapProviderSettingsDto,
}

impl From<UpdateMapSettingsRequest> for MapServiceSettings {
    fn from(value: UpdateMapSettingsRequest) -> Self {
        Self {
            selected_provider: value.selected_provider.into(),
            tencent: value.tencent.into(),
            amap: value.amap.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MiniAppHomeRuntimeConfigDto {
    pub match_card_limit: u8,
    pub challenge_card_limit: u8,
    pub activity_fetch_page_size: u8,
    pub hide_matches_after_holding_time: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MiniAppMatchesRuntimeConfigDto {
    pub related_activity_limit: u8,
    pub participant_avatar_limit: u8,
    pub capacity_extra_slots: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MiniAppCheckinRuntimeConfigDto {
    pub default_radius_meters: u16,
    pub default_open_minutes_before: u16,
    pub default_close_minutes_after: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MiniAppBillingRuntimeConfigDto {
    pub recent_order_limit: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MiniAppNotificationsRuntimeConfigDto {
    pub list_limit: u8,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct MiniAppProfileRuntimeConfigDto {
    pub require_phone_binding: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MiniAppRuntimeConfigDto {
    pub home: MiniAppHomeRuntimeConfigDto,
    pub matches: MiniAppMatchesRuntimeConfigDto,
    pub checkin: MiniAppCheckinRuntimeConfigDto,
    pub billing: MiniAppBillingRuntimeConfigDto,
    pub notifications: MiniAppNotificationsRuntimeConfigDto,
    #[serde(default)]
    pub profile: MiniAppProfileRuntimeConfigDto,
}

impl From<MiniAppRuntimeConfig> for MiniAppRuntimeConfigDto {
    fn from(value: MiniAppRuntimeConfig) -> Self {
        Self {
            home: MiniAppHomeRuntimeConfigDto {
                match_card_limit: value.home.match_card_limit,
                challenge_card_limit: value.home.challenge_card_limit,
                activity_fetch_page_size: value.home.activity_fetch_page_size,
                hide_matches_after_holding_time: value.home.hide_matches_after_holding_time,
            },
            matches: MiniAppMatchesRuntimeConfigDto {
                related_activity_limit: value.matches.related_activity_limit,
                participant_avatar_limit: value.matches.participant_avatar_limit,
                capacity_extra_slots: value.matches.capacity_extra_slots,
            },
            checkin: MiniAppCheckinRuntimeConfigDto {
                default_radius_meters: value.checkin.default_radius_meters,
                default_open_minutes_before: value.checkin.default_open_minutes_before,
                default_close_minutes_after: value.checkin.default_close_minutes_after,
            },
            billing: MiniAppBillingRuntimeConfigDto {
                recent_order_limit: value.billing.recent_order_limit,
            },
            notifications: MiniAppNotificationsRuntimeConfigDto {
                list_limit: value.notifications.list_limit,
            },
            profile: MiniAppProfileRuntimeConfigDto {
                require_phone_binding: value.profile.require_phone_binding,
            },
        }
    }
}

impl From<MiniAppRuntimeConfigDto> for MiniAppRuntimeConfig {
    fn from(value: MiniAppRuntimeConfigDto) -> Self {
        Self {
            home: MiniAppHomeRuntimeConfig {
                match_card_limit: value.home.match_card_limit,
                challenge_card_limit: value.home.challenge_card_limit,
                activity_fetch_page_size: value.home.activity_fetch_page_size,
                hide_matches_after_holding_time: value.home.hide_matches_after_holding_time,
            },
            matches: MiniAppMatchesRuntimeConfig {
                related_activity_limit: value.matches.related_activity_limit,
                participant_avatar_limit: value.matches.participant_avatar_limit,
                capacity_extra_slots: value.matches.capacity_extra_slots,
            },
            checkin: MiniAppCheckinRuntimeConfig {
                default_radius_meters: value.checkin.default_radius_meters,
                default_open_minutes_before: value.checkin.default_open_minutes_before,
                default_close_minutes_after: value.checkin.default_close_minutes_after,
            },
            billing: MiniAppBillingRuntimeConfig {
                recent_order_limit: value.billing.recent_order_limit,
            },
            notifications: MiniAppNotificationsRuntimeConfig {
                list_limit: value.notifications.list_limit,
            },
            profile: MiniAppProfileRuntimeConfig {
                require_phone_binding: value.profile.require_phone_binding,
            },
        }
    }
}
