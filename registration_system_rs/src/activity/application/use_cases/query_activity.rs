use crate::activity::application::error::ActivityApplicationError;
use crate::activity::application::principal::ActivityPrincipal;
use crate::activity::application::read_models::OngoingActivityInfo;
use crate::activity::domain::{
    Activity, ActivityListPage, ActivityRegistration, RegistrationListPage,
};
use crate::activity::ports::ActivityQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct QueryActivityUseCase {
    repository: Arc<dyn ActivityQueryRepository>,
}

impl QueryActivityUseCase {
    pub fn new(repository: Arc<dyn ActivityQueryRepository>) -> Self {
        Self { repository }
    }

    pub async fn list_activities(
        &self,
        status_filter: Option<i8>,
        registration_scope: Option<&str>,
        page: u32,
        page_size: u32,
    ) -> Result<ActivityListPage, ActivityApplicationError> {
        self.repository
            .list_page(status_filter, registration_scope, page, page_size)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询活动列表失败: {error}"))
            })
    }

    pub async fn get_activity(
        &self,
        activity_id: &str,
    ) -> Result<Activity, ActivityApplicationError> {
        let mut activity = self
            .repository
            .find_by_id(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询活动详情失败: {error}"))
            })?
            .ok_or_else(|| ActivityApplicationError::NotFound("活动不存在".to_string()))?;

        activity.team_checkin_configs = self
            .repository
            .list_team_checkin_configs(&activity.id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询签到配置失败: {error}"))
            })?;

        Ok(activity)
    }

    pub async fn check_ongoing_activities(
        &self,
    ) -> Result<OngoingActivityInfo, ActivityApplicationError> {
        let activity = self
            .repository
            .find_ongoing_activity()
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("检查进行中活动失败: {error}"))
            })?;

        Ok(OngoingActivityInfo {
            has_ongoing: activity.is_some(),
            activity,
        })
    }

    pub async fn list_activity_users(
        &self,
        activity_id: &str,
    ) -> Result<Vec<ActivityRegistration>, ActivityApplicationError> {
        self.repository
            .list_registrations(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询报名列表失败: {error}"))
            })
    }

    pub async fn list_registrations_with_info(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        stand_filter: Option<i8>,
        page: u32,
        page_size: u32,
    ) -> Result<RegistrationListPage, ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        let activity = self.get_activity(activity_id).await?;
        self.repository
            .list_registrations_with_info_page(
                activity_id,
                activity.holding_date,
                stand_filter,
                page,
                page_size,
            )
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询报名列表失败: {error}"))
            })
    }
}
