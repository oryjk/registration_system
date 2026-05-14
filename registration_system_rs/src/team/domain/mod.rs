mod credit;
pub mod error;
mod team;

pub use credit::{
    DEFAULT_TEAM_CREDIT_SCORE, MAX_TEAM_CREDIT_SCORE, clamp_credit_score, credit_label,
    membership_credit_delta, membership_price, rating_to_credit_delta,
};
pub use error::DomainError;
pub use team::{
    ActivityTeamReview, Team, TeamAdminInfo, TeamAttendanceRankingItem, TeamCreditTransaction,
    TeamMember, TeamMemberAttendanceRecord, TeamMemberWithInfo, UpdateTeamFields,
};

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn review_rating_maps_to_expected_credit_delta() {
        assert_eq!(rating_to_credit_delta(1), Some(0));
        assert_eq!(rating_to_credit_delta(2), Some(2));
        assert_eq!(rating_to_credit_delta(3), Some(4));
        assert_eq!(rating_to_credit_delta(4), Some(6));
        assert_eq!(rating_to_credit_delta(5), Some(8));
        assert_eq!(rating_to_credit_delta(0), None);
    }

    #[test]
    fn membership_recharge_uses_month_count_to_compute_credit_and_price() {
        assert_eq!(membership_credit_delta(1), Some(6));
        assert_eq!(membership_credit_delta(3), Some(18));
        assert_eq!(membership_price(3), Some(Decimal::from(90)));
        assert_eq!(membership_credit_delta(0), None);
    }

    #[test]
    fn credit_score_is_clamped_into_allowed_range() {
        assert_eq!(clamp_credit_score(-8), 0);
        assert_eq!(clamp_credit_score(64), 64);
        assert_eq!(clamp_credit_score(130), MAX_TEAM_CREDIT_SCORE);
    }

    #[test]
    fn credit_label_reflects_score_band_and_vip_state() {
        assert_eq!(credit_label(92, true), "会员·金牌信用");
        assert_eq!(credit_label(82, false), "稳定赴约");
        assert_eq!(credit_label(55, false), "风险较高");
    }
}
