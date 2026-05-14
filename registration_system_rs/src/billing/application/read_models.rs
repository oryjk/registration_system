use rust_decimal::Decimal;

#[derive(Debug, Clone)]
pub struct ActivityExpenseResult {
    pub activity_id: String,
    pub total_amount: Decimal,
    pub aa_fee: Decimal,
    pub user_count: usize,
    pub billing_ids: Vec<i64>,
}

#[derive(Debug, Clone)]
pub struct PenaltyResult {
    pub penalty_id: i64,
    pub fund_transaction_id: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct CalibrationResult {
    pub calibration_id: i64,
    pub current_balance: Decimal,
}
