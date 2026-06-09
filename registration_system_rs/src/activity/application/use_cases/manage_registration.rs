use crate::activity::application::commands::UpdateMyStandCommand;
use crate::activity::application::error::ActivityApplicationError;
use crate::activity::application::principal::ActivityPrincipal;
use crate::activity::ports::{ActivityCommandRepository, ActivityQueryRepository};
use std::collections::BTreeSet;
use std::sync::Arc;

#[derive(Clone)]
pub struct ManageRegistrationUseCase {
    query_repository: Arc<dyn ActivityQueryRepository>,
    command_repository: Arc<dyn ActivityCommandRepository>,
}

impl ManageRegistrationUseCase {
    pub fn new(
        query_repository: Arc<dyn ActivityQueryRepository>,
        command_repository: Arc<dyn ActivityCommandRepository>,
    ) -> Self {
        Self {
            query_repository,
            command_repository,
        }
    }

    pub async fn update_my_stand(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        command: UpdateMyStandCommand,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_user() {
            return Err(ActivityApplicationError::Forbidden);
        }

        if command.stand == 0 {
            self.command_repository
                .delete_registration(activity_id, actor.id)
                .await
                .map_err(|error| {
                    ActivityApplicationError::internal(format!("删除报名记录失败: {error}"))
                })?;
            return Ok(());
        }

        self.ensure_capacity_available(activity_id, actor.id, command.stand)
            .await?;

        self.command_repository
            .upsert_registration(
                activity_id,
                actor.id,
                command.stand,
                command.registration_count,
            )
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("更新报名状态失败: {error}"))
            })
    }

    pub async fn update_user_stand(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_id: i64,
        command: UpdateMyStandCommand,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_admin() && actor.id != user_id {
            return Err(ActivityApplicationError::Forbidden);
        }

        self.ensure_capacity_available(activity_id, user_id, command.stand)
            .await?;

        self.command_repository
            .upsert_registration(
                activity_id,
                user_id,
                command.stand,
                command.registration_count,
            )
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("更新报名状态失败: {error}"))
            })
    }

    pub async fn delete_user_registration(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_id: i64,
    ) -> Result<u64, ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        self.command_repository
            .delete_registration(activity_id, user_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("删除报名记录失败: {error}"))
            })
    }

    pub async fn admin_register_user(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_id: i64,
        stand: i8,
        registration_count: i32,
    ) -> Result<(), ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        self.ensure_activity_exists(activity_id).await?;
        self.ensure_capacity_available(activity_id, user_id, stand)
            .await?;
        self.command_repository
            .upsert_registration(activity_id, user_id, stand, registration_count)
            .await
            .map_err(|error| ActivityApplicationError::internal(format!("报名操作失败: {error}")))
    }

    pub async fn batch_update_user_stand(
        &self,
        actor: &ActivityPrincipal,
        activity_id: &str,
        user_ids: &[i64],
        stand: i8,
        registration_count: i32,
    ) -> Result<u64, ActivityApplicationError> {
        if !actor.is_admin() {
            return Err(ActivityApplicationError::Forbidden);
        }
        if user_ids.is_empty() {
            return Ok(0);
        }
        self.ensure_activity_exists(activity_id).await?;
        let unique_user_ids = user_ids.iter().copied().collect::<BTreeSet<_>>();
        for user_id in &unique_user_ids {
            self.ensure_capacity_available(activity_id, *user_id, stand)
                .await?;
            self.command_repository
                .upsert_registration(activity_id, *user_id, stand, registration_count)
                .await
                .map_err(|error| {
                    ActivityApplicationError::internal(format!("批量更新报名状态失败: {error}"))
                })?;
        }
        Ok(unique_user_ids.len() as u64)
    }

    async fn ensure_capacity_available(
        &self,
        activity_id: &str,
        user_id: i64,
        next_stand: i8,
    ) -> Result<(), ActivityApplicationError> {
        if next_stand != 1 && next_stand != 3 {
            return Ok(());
        }

        let activity = self
            .query_repository
            .find_by_id(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询活动详情失败: {error}"))
            })?
            .ok_or_else(|| ActivityApplicationError::NotFound("活动不存在".to_string()))?;
        let Some(limit) = activity.team_capacity_limit else {
            return Ok(());
        };

        let registrations = self
            .query_repository
            .list_registrations(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询报名记录失败: {error}"))
            })?;
        let already_counts = registrations
            .iter()
            .any(|item| item.user_id == user_id && (item.stand == 1 || item.stand == 3));
        if already_counts {
            return Ok(());
        }

        let current_count = self
            .query_repository
            .count_capacity_registrations(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询报名人数失败: {error}"))
            })?;
        if current_count >= i64::from(limit) {
            return Err(ActivityApplicationError::Validation(
                "报名人数已满".to_string(),
            ));
        }

        Ok(())
    }

    async fn ensure_activity_exists(
        &self,
        activity_id: &str,
    ) -> Result<(), ActivityApplicationError> {
        self.query_repository
            .find_by_id(activity_id)
            .await
            .map_err(|error| {
                ActivityApplicationError::internal(format!("查询活动详情失败: {error}"))
            })?
            .ok_or_else(|| ActivityApplicationError::NotFound("活动不存在".to_string()))?;
        Ok(())
    }
}
