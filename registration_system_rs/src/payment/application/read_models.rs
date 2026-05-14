use crate::payment::domain::WxMiniPaymentParams;

#[derive(Debug, Clone)]
pub struct CreateRechargeOrderResult {
    pub order_no: String,
    pub params: WxMiniPaymentParams,
}

#[derive(Debug, Clone)]
pub struct CreateTeamMembershipOrderResult {
    pub order_no: String,
    pub params: WxMiniPaymentParams,
}
