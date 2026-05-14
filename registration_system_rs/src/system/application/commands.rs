use crate::system::domain::MapServiceSettings;

#[derive(Debug, Clone)]
pub struct UpdateMapSettingsCommand {
    pub settings: MapServiceSettings,
}
