use crate::user::domain::{
    DomainError, PlayerAdminListQuery, PlayerListResult, PlayerTeamSummary, User,
    UserActivityRecord, UserAttendanceRanking, UserAttendanceRecord,
};
use async_trait::async_trait;

#[async_trait]
pub trait UserQueryRepository: Send + Sync {
    async fn find_by_open_id(&self, open_id: &str) -> Result<Option<User>, DomainError>;
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, DomainError>;
    async fn find_by_id(&self, user_id: i64) -> Result<Option<User>, DomainError>;
    async fn list_active(&self) -> Result<Vec<User>, DomainError>;
    async fn search(&self, keyword: &str, limit: i64) -> Result<Vec<User>, DomainError>;

    /// 管理后台：分页查询球员列表（可按关键字、状态过滤）
    async fn list_players_admin(
        &self,
        query: PlayerAdminListQuery<'_>,
    ) -> Result<PlayerListResult, DomainError>;

    /// 批量查询球员的球队归属（用于 list_players_admin 的团队聚合）
    async fn find_player_teams(
        &self,
        user_ids: &[i64],
    ) -> Result<Vec<(i64, PlayerTeamSummary)>, DomainError>;
    async fn find_activities(&self, user_id: i64) -> Result<Vec<UserActivityRecord>, DomainError>;
    async fn find_attendance_records(
        &self,
        user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRecord>, DomainError>;
    async fn find_attendance_ranking(
        &self,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Vec<UserAttendanceRanking>, DomainError>;
    async fn find_attendance_ranking_for_user(
        &self,
        user_id: i64,
        start_date: Option<&str>,
        end_date: Option<&str>,
    ) -> Result<Option<UserAttendanceRanking>, DomainError>;
}

#[async_trait]
pub trait UserCommandRepository: Send + Sync {
    async fn create(&self, user: &User) -> Result<User, DomainError>;
    async fn touch_login(&self, user_id: i64) -> Result<(), DomainError>;
    async fn update_password_hash(
        &self,
        user_id: i64,
        password_hash: &str,
    ) -> Result<(), DomainError>;
    async fn update_profile(
        &self,
        user_id: i64,
        nickname: Option<&str>,
        real_name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<(), DomainError>;
    async fn update_fields(
        &self,
        user_id: i64,
        fields: crate::user::domain::UpdateUserFields<'_>,
    ) -> Result<(), DomainError>;
    async fn delete(&self, user_id: i64) -> Result<(), DomainError>;
}
