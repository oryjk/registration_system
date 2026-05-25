use crate::payment::application::commands::{
    CreateChallengePaymentOrderCommand, CreateTeamMembershipOrderCommand,
};
use crate::payment::application::openid_resolver::PaymentOpenIdResolver;
use crate::payment::application::read_models::{
    CreateChallengePaymentOrderResult, CreateRechargeOrderResult, CreateTeamMembershipOrderResult,
};
use crate::payment::application::use_cases::{
    CreateChallengePaymentOrderUseCase, CreateRechargeOrderUseCase,
    CreateTeamMembershipOrderUseCase, HandlePaidOrderUseCase, QueryPaymentOrdersUseCase,
};
use crate::payment::domain::{PaymentOrder, PaymentQueryResult};
use crate::payment::ports::{
    ActivityPaymentAccessPort, PaymentOrderCommandRepository, PaymentOrderQueryRepository,
    PaymentSettlementPort, WxPayGateway,
};
use crate::shared::auth::ActorContext;
use crate::shared::error::AppError;
use crate::team::ports::TeamQueryRepository;
use crate::user::ports::UserQueryRepository;
use rust_decimal::Decimal;
use std::sync::Arc;

#[derive(Clone)]
pub struct PaymentService {
    create_recharge_order_use_case: CreateRechargeOrderUseCase,
    create_challenge_payment_order_use_case: CreateChallengePaymentOrderUseCase,
    create_team_membership_order_use_case: CreateTeamMembershipOrderUseCase,
    handle_paid_order_use_case: HandlePaidOrderUseCase,
    query_orders_use_case: QueryPaymentOrdersUseCase,
}

impl PaymentService {
    pub fn new(
        query_repository: Arc<dyn PaymentOrderQueryRepository>,
        command_repository: Arc<dyn PaymentOrderCommandRepository>,
        settlement_port: Arc<dyn PaymentSettlementPort>,
        activity_payment_access_port: Arc<dyn ActivityPaymentAccessPort>,
        wx_pay_gateway: Arc<dyn WxPayGateway>,
        team_repository: Arc<dyn TeamQueryRepository>,
        user_repository: Arc<dyn UserQueryRepository>,
    ) -> Self {
        let openid_resolver = PaymentOpenIdResolver::new(user_repository);

        Self {
            create_recharge_order_use_case: CreateRechargeOrderUseCase::new(
                command_repository.clone(),
                wx_pay_gateway.clone(),
                openid_resolver.clone(),
            ),
            create_challenge_payment_order_use_case: CreateChallengePaymentOrderUseCase::new(
                command_repository.clone(),
                activity_payment_access_port,
                wx_pay_gateway.clone(),
                openid_resolver.clone(),
            ),
            create_team_membership_order_use_case: CreateTeamMembershipOrderUseCase::new(
                command_repository.clone(),
                team_repository,
                wx_pay_gateway.clone(),
                openid_resolver,
            ),
            handle_paid_order_use_case: HandlePaidOrderUseCase::new(
                query_repository.clone(),
                command_repository.clone(),
                settlement_port,
                wx_pay_gateway,
            ),
            query_orders_use_case: QueryPaymentOrdersUseCase::new(
                query_repository,
                command_repository,
            ),
        }
    }

    pub async fn create_recharge_order(
        &self,
        actor: &ActorContext,
        amount: Decimal,
        openid: Option<&str>,
    ) -> Result<CreateRechargeOrderResult, AppError> {
        self.create_recharge_order_use_case
            .execute(actor, amount, openid)
            .await
    }

    pub async fn create_team_membership_order(
        &self,
        actor: &ActorContext,
        command: CreateTeamMembershipOrderCommand,
    ) -> Result<CreateTeamMembershipOrderResult, AppError> {
        self.create_team_membership_order_use_case
            .execute(actor, command)
            .await
    }

    pub async fn create_challenge_payment_order(
        &self,
        actor: &ActorContext,
        command: CreateChallengePaymentOrderCommand,
    ) -> Result<CreateChallengePaymentOrderResult, AppError> {
        self.create_challenge_payment_order_use_case
            .execute(actor, command)
            .await
    }

    pub async fn get_order_status(
        &self,
        actor: &ActorContext,
        order_no: &str,
    ) -> Result<Option<PaymentOrder>, AppError> {
        self.query_orders_use_case
            .get_order_status(actor, order_no)
            .await
    }

    pub async fn sync_order_status(
        &self,
        actor: &ActorContext,
        order_no: &str,
    ) -> Result<PaymentQueryResult, AppError> {
        self.query_orders_use_case
            .get_order_status(actor, order_no)
            .await?
            .ok_or_else(|| AppError::NotFound("支付订单不存在".to_string()))?;

        self.handle_paid_order_use_case
            .sync_order_status(order_no)
            .await
    }

    pub async fn get_user_orders(
        &self,
        actor: &ActorContext,
        limit: i64,
    ) -> Result<Vec<PaymentOrder>, AppError> {
        self.query_orders_use_case
            .get_user_orders(actor, limit)
            .await
    }

    pub async fn handle_wx_pay_notify(
        &self,
        order_no: &str,
        transaction_id: &str,
        total_fee: i64,
    ) -> Result<bool, AppError> {
        self.handle_paid_order_use_case
            .handle_wx_pay_notify(order_no, transaction_id, total_fee)
            .await
    }

    pub async fn cancel_order(
        &self,
        actor: &ActorContext,
        order_no: &str,
    ) -> Result<bool, AppError> {
        self.query_orders_use_case
            .cancel_order(actor, order_no)
            .await
    }
}
