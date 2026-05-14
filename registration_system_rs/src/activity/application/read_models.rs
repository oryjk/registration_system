use crate::activity::domain::Activity;

#[derive(Debug, Clone)]
pub struct OngoingActivityInfo {
    pub has_ongoing: bool,
    pub activity: Option<Activity>,
}
