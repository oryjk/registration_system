use rust_decimal::Decimal;

pub const DEFAULT_TEAM_CREDIT_SCORE: i32 = 60;
pub const MAX_TEAM_CREDIT_SCORE: i32 = 100;
const MEMBERSHIP_CREDIT_PER_MONTH: i32 = 6;
const MEMBERSHIP_PRICE_PER_MONTH: i32 = 30;

pub fn clamp_credit_score(score: i32) -> i32 {
    score.clamp(0, MAX_TEAM_CREDIT_SCORE)
}

pub fn rating_to_credit_delta(rating: i8) -> Option<i32> {
    match rating {
        1 => Some(0),
        2 => Some(2),
        3 => Some(4),
        4 => Some(6),
        5 => Some(8),
        _ => None,
    }
}

pub fn membership_credit_delta(months: i32) -> Option<i32> {
    if months <= 0 {
        return None;
    }

    Some(months * MEMBERSHIP_CREDIT_PER_MONTH)
}

pub fn membership_price(months: i32) -> Option<Decimal> {
    if months <= 0 {
        return None;
    }

    Some(Decimal::from(months * MEMBERSHIP_PRICE_PER_MONTH))
}

pub fn credit_label(score: i32, is_vip: bool) -> String {
    let base = match score {
        90..=MAX_TEAM_CREDIT_SCORE => "金牌信用",
        80..=89 => "稳定赴约",
        70..=79 => "评价稳定",
        60..=69 => "待观察",
        _ => "风险较高",
    };

    if is_vip {
        format!("会员·{base}")
    } else {
        base.to_string()
    }
}
