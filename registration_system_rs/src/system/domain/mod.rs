#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MapProvider {
    Tencent,
    Amap,
}

impl MapProvider {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Tencent => "tencent",
            Self::Amap => "amap",
        }
    }

    pub const fn display_name(self) -> &'static str {
        match self {
            Self::Tencent => "腾讯地图",
            Self::Amap => "高德地图",
        }
    }
}

impl TryFrom<&str> for MapProvider {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.trim().to_ascii_lowercase().as_str() {
            "tencent" => Ok(Self::Tencent),
            "amap" => Ok(Self::Amap),
            other => Err(format!("不支持的地图服务商: {other}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MapProviderSettings {
    pub key: String,
    pub secret: String,
    pub web_service_base_url: String,
}

impl MapProviderSettings {
    pub fn sanitize(mut self, default_base_url: &str) -> Self {
        self.key = self.key.trim().to_string();
        self.secret = self.secret.trim().to_string();
        self.web_service_base_url = if self.web_service_base_url.trim().is_empty() {
            default_base_url.to_string()
        } else {
            self.web_service_base_url
                .trim()
                .trim_end_matches('/')
                .to_string()
        };
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MapServiceSettings {
    pub selected_provider: MapProvider,
    pub tencent: MapProviderSettings,
    pub amap: MapProviderSettings,
}

impl MapServiceSettings {
    pub fn defaults() -> Self {
        Self {
            selected_provider: MapProvider::Tencent,
            tencent: MapProviderSettings {
                key: String::new(),
                secret: String::new(),
                web_service_base_url: "https://apis.map.qq.com".to_string(),
            },
            amap: MapProviderSettings {
                key: String::new(),
                secret: String::new(),
                web_service_base_url: "https://restapi.amap.com".to_string(),
            },
        }
    }

    pub fn sanitize(self) -> Self {
        Self {
            selected_provider: self.selected_provider,
            tencent: self.tencent.sanitize("https://apis.map.qq.com"),
            amap: self.amap.sanitize("https://restapi.amap.com"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MiniAppRuntimeConfig {
    pub home: MiniAppHomeRuntimeConfig,
    pub matches: MiniAppMatchesRuntimeConfig,
    pub checkin: MiniAppCheckinRuntimeConfig,
    pub billing: MiniAppBillingRuntimeConfig,
    pub notifications: MiniAppNotificationsRuntimeConfig,
    #[serde(default)]
    pub profile: MiniAppProfileRuntimeConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MiniAppHomeRuntimeConfig {
    pub match_card_limit: u8,
    pub challenge_card_limit: u8,
    pub activity_fetch_page_size: u8,
    pub hide_matches_after_holding_time: bool,
    #[serde(default = "default_home_hero_banners")]
    pub hero_banners: Vec<MiniAppHomeHeroBanner>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MiniAppHomeHeroBanner {
    pub title: String,
    pub subtitle: String,
    pub button_text: String,
    pub image_url: String,
    pub enabled: bool,
    pub sort_order: i16,
}

impl MiniAppHomeHeroBanner {
    pub fn default_banner() -> Self {
        Self {
            title: "约球开踢".to_string(),
            subtitle: "组队 · 报名 · 上场".to_string(),
            button_text: "去看看".to_string(),
            image_url: String::new(),
            enabled: true,
            sort_order: 1,
        }
    }

    pub fn sanitize(mut self) -> Option<Self> {
        self.title = truncate_chars(self.title.trim(), 20);
        self.subtitle = truncate_chars(self.subtitle.trim(), 30);
        self.button_text = truncate_chars(self.button_text.trim(), 10);
        self.image_url = truncate_chars(self.image_url.trim(), 512);

        if self.title.is_empty() {
            return None;
        }

        if self.button_text.is_empty() {
            self.button_text = "去看看".to_string();
        }

        Some(self)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MiniAppMatchesRuntimeConfig {
    pub related_activity_limit: u8,
    pub participant_avatar_limit: u8,
    pub capacity_extra_slots: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MiniAppCheckinRuntimeConfig {
    pub default_radius_meters: u16,
    pub default_open_minutes_before: u16,
    pub default_close_minutes_after: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MiniAppBillingRuntimeConfig {
    pub recent_order_limit: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MiniAppNotificationsRuntimeConfig {
    pub list_limit: u8,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct MiniAppProfileRuntimeConfig {
    pub require_phone_binding: bool,
}

impl MiniAppRuntimeConfig {
    pub const CONFIG_KEY: &'static str = "mini_app";

    pub fn defaults() -> Self {
        Self {
            home: MiniAppHomeRuntimeConfig {
                match_card_limit: 2,
                challenge_card_limit: 2,
                activity_fetch_page_size: 100,
                hide_matches_after_holding_time: true,
                hero_banners: default_home_hero_banners(),
            },
            matches: MiniAppMatchesRuntimeConfig {
                related_activity_limit: 2,
                participant_avatar_limit: 5,
                capacity_extra_slots: 2,
            },
            checkin: MiniAppCheckinRuntimeConfig {
                default_radius_meters: 200,
                default_open_minutes_before: 60,
                default_close_minutes_after: 45,
            },
            billing: MiniAppBillingRuntimeConfig {
                recent_order_limit: 10,
            },
            notifications: MiniAppNotificationsRuntimeConfig { list_limit: 50 },
            profile: MiniAppProfileRuntimeConfig::default(),
        }
    }

    pub fn sanitize(mut self) -> Self {
        let defaults = Self::defaults();
        self.home.match_card_limit = self.home.match_card_limit.clamp(1, 10);
        self.home.challenge_card_limit = self.home.challenge_card_limit.clamp(1, 10);
        self.home.activity_fetch_page_size = self.home.activity_fetch_page_size.clamp(20, 100);
        self.home.hero_banners = sanitize_home_hero_banners(self.home.hero_banners);
        self.matches.related_activity_limit = self.matches.related_activity_limit.clamp(1, 10);
        self.matches.participant_avatar_limit = self.matches.participant_avatar_limit.clamp(1, 10);
        self.matches.capacity_extra_slots = self.matches.capacity_extra_slots.clamp(0, 20);
        self.checkin.default_radius_meters = self.checkin.default_radius_meters.clamp(50, 5000);
        self.checkin.default_open_minutes_before =
            self.checkin.default_open_minutes_before.clamp(0, 1440);
        self.checkin.default_close_minutes_after =
            self.checkin.default_close_minutes_after.clamp(0, 1440);
        self.billing.recent_order_limit = self.billing.recent_order_limit.clamp(1, 50);
        self.notifications.list_limit = self.notifications.list_limit.clamp(1, 100);

        if self.home.activity_fetch_page_size < self.home.match_card_limit {
            self.home.activity_fetch_page_size = defaults.home.activity_fetch_page_size;
        }

        self
    }
}

fn default_home_hero_banners() -> Vec<MiniAppHomeHeroBanner> {
    vec![MiniAppHomeHeroBanner::default_banner()]
}

fn sanitize_home_hero_banners(
    banners: Vec<MiniAppHomeHeroBanner>,
) -> Vec<MiniAppHomeHeroBanner> {
    let mut banners = banners
        .into_iter()
        .filter_map(MiniAppHomeHeroBanner::sanitize)
        .take(10)
        .collect::<Vec<_>>();

    if banners.is_empty() {
        return default_home_hero_banners();
    }

    banners.sort_by_key(|banner| banner.sort_order);
    banners
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}
