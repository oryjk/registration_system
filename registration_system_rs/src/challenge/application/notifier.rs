use crate::challenge::domain::Challenge;
use crate::notification::application::NotificationService;
use crate::shared::error::AppError;
use std::sync::Arc;

#[derive(Clone)]
pub struct ChallengeNotifier {
    notification_service: Arc<NotificationService>,
}

impl ChallengeNotifier {
    pub fn new(notification_service: Arc<NotificationService>) -> Self {
        Self {
            notification_service,
        }
    }

    pub async fn challenge_created(&self, challenge: &Challenge) -> Result<(), AppError> {
        self.notification_service
            .send_to_users(
                &[challenge.host_user_id],
                "challenge_created",
                "约队已发布",
                &format!(
                    "你发布的“{}”已进入约队大厅，等待其他球队接约。",
                    challenge.title
                ),
                Some("challenge"),
                Some(&challenge.id),
            )
            .await?;
        Ok(())
    }

    pub async fn challenge_cancelled(&self, challenge: &Challenge) -> Result<(), AppError> {
        self.notification_service
            .send_to_users(
                &[challenge.host_user_id],
                "challenge_cancelled",
                "约队已取消",
                &format!("你发布的“{}”已取消，不再继续匹配。", challenge.title),
                Some("challenge"),
                Some(&challenge.id),
            )
            .await?;
        Ok(())
    }

    pub async fn challenge_matched(
        &self,
        recipient_ids: &[i64],
        challenge: &Challenge,
        host_team_name: &str,
        guest_team_name: &str,
    ) -> Result<(), AppError> {
        self.notification_service
            .send_to_users(
                recipient_ids,
                "challenge_matched",
                "约队已约成",
                &format!(
                    "{} 与 {} 已约成，比赛“{}”待报名。",
                    host_team_name, guest_team_name, challenge.title
                ),
                Some("challenge"),
                Some(&challenge.id),
            )
            .await?;
        Ok(())
    }

    pub async fn postpaid_payment_due(
        &self,
        user_id: i64,
        challenge_id: &str,
        challenge_title: &str,
    ) -> Result<(), AppError> {
        self.notification_service
            .send_to_users(
                &[user_id],
                "challenge_payment_due",
                "散人报名待支付",
                &format!("你参加的“{}”已结束，请完成报名费用支付。", challenge_title),
                Some("challenge"),
                Some(challenge_id),
            )
            .await?;
        Ok(())
    }
}
