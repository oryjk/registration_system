use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::user::application::permissions::ensure_admin_or_self;
use crate::user::domain::{User, UserActivityRecord, UserAttendanceRanking, UserAttendanceRecord};
use crate::user::ports::UserQueryRepository;
use std::sync::Arc;

#[derive(Clone)]
pub struct UserQueryUseCase {
    repository: Arc<dyn UserQueryRepository>,
}

impl UserQueryUseCase {
    pub fn new(repository: Arc<dyn UserQueryRepository>) -> Self {
        Self { repository }
    }

    pub async fn list_users(&self) -> Result<Vec<User>, AppError> {
        self.repository
            .list_active()
            .await
            .map_err(|error| AppError::internal(format!("查询用户列表失败: {error}")))
    }

    pub async fn search_users(
        &self,
        actor: &ActorContext,
        keyword: &str,
        limit: i64,
    ) -> Result<Vec<User>, AppError> {
        let _ = actor;
        self.repository
            .search(keyword, limit)
            .await
            .map_err(|error| AppError::internal(format!("搜索用户失败: {error}")))
    }

    pub async fn get_user_activities(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
    ) -> Result<Vec<UserActivityRecord>, AppError> {
        ensure_admin_or_self(actor, target_user_id)?;
        self.repository
            .find_activities(target_user_id)
            .await
            .map_err(|error| AppError::internal(format!("查询用户活动失败: {error}")))
    }

    pub async fn get_user_attendance_records(
        &self,
        actor: &ActorContext,
        target_user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRecord>, AppError> {
        ensure_admin_or_self(actor, target_user_id)?;
        self.repository
            .find_attendance_records(target_user_id, start_date, end_date)
            .await
            .map_err(|error| AppError::internal(format!("查询出勤记录失败: {error}")))
    }

    pub async fn get_user_attendance_ranking(
        &self,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRanking>, AppError> {
        self.repository
            .find_attendance_ranking(start_date, end_date)
            .await
            .map_err(|error| AppError::internal(format!("查询出勤排名失败: {error}")))
    }

    pub async fn get_user_attendance_ranking_for_user(
        &self,
        target_user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Option<UserAttendanceRanking>, AppError> {
        self.repository
            .find_attendance_ranking_for_user(target_user_id, start_date, end_date)
            .await
            .map_err(|error| AppError::internal(format!("查询用户出勤排名失败: {error}")))
    }
}
