use async_trait::async_trait;
use chrono::Utc;
use registration_system_backend::notification::application::NotificationService;
use registration_system_backend::notification::domain::{DomainError, Notification};
use registration_system_backend::notification::ports::{
    NotificationCommandRepository, NotificationQueryRepository,
};
use registration_system_backend::shared::auth::{ActorContext, ActorKind};
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct FakeNotificationRepository {
    items: Mutex<Vec<Notification>>,
}

#[async_trait]
impl NotificationCommandRepository for FakeNotificationRepository {
    async fn create_many(&self, notifications: &[Notification]) -> Result<(), DomainError> {
        self.items
            .lock()
            .unwrap()
            .extend(notifications.iter().cloned());
        Ok(())
    }

    async fn mark_all_read(&self, user_id: i64) -> Result<u64, DomainError> {
        let now = Utc::now().naive_utc();
        let mut count = 0;
        for item in self.items.lock().unwrap().iter_mut() {
            if item.user_id == user_id && item.read_at.is_none() {
                item.read_at = Some(now);
                item.updated_at = now;
                count += 1;
            }
        }
        Ok(count)
    }
}

#[async_trait]
impl NotificationQueryRepository for FakeNotificationRepository {
    async fn list_for_user(
        &self,
        user_id: i64,
        unread_only: bool,
        limit: i64,
    ) -> Result<Vec<Notification>, DomainError> {
        let mut items = self
            .items
            .lock()
            .unwrap()
            .iter()
            .filter(|item| item.user_id == user_id)
            .filter(|item| !unread_only || item.read_at.is_none())
            .cloned()
            .collect::<Vec<_>>();
        items.sort_by(|left, right| right.created_at.cmp(&left.created_at));
        items.truncate(limit.max(1) as usize);
        Ok(items)
    }

    async fn count_unread(&self, user_id: i64) -> Result<i64, DomainError> {
        Ok(self
            .items
            .lock()
            .unwrap()
            .iter()
            .filter(|item| item.user_id == user_id && item.read_at.is_none())
            .count() as i64)
    }
}

fn user_actor(id: i64) -> ActorContext {
    ActorContext {
        id,
        actor_kind: ActorKind::User,
        is_super_admin: false,
    }
}

#[tokio::test]
async fn notification_service_tracks_unread_and_mark_all_read() {
    let repository = Arc::new(FakeNotificationRepository::default());
    let service = NotificationService::new(repository.clone(), repository);

    service
        .send_to_users(
            &[7, 7, 8],
            "challenge_matched",
            "约队已约成",
            "你有一场新的比赛待报名",
            Some("challenge"),
            Some("challenge-1"),
        )
        .await
        .expect("notifications should be created");

    let unread = service
        .get_unread_count(&user_actor(7))
        .await
        .expect("unread count should load");
    assert_eq!(unread, 1);

    let items = service
        .list_my_notifications(&user_actor(7), true, 20)
        .await
        .expect("notifications should load");
    assert_eq!(items.len(), 1);

    let marked = service
        .mark_all_read(&user_actor(7))
        .await
        .expect("all notifications should be marked read");
    assert_eq!(marked, 1);

    let unread_after = service
        .get_unread_count(&user_actor(7))
        .await
        .expect("unread count should update");
    assert_eq!(unread_after, 0);
}
