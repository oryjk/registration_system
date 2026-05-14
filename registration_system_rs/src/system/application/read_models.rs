use crate::system::domain::MapProvider;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MapPreviewSettings {
    pub selected_provider: MapProvider,
    pub tencent_map_key: String,
}
