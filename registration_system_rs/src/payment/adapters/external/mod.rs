mod mock_wx_pay_gateway;
mod real_wx_pay_gateway;

pub use mock_wx_pay_gateway::MockWxPayGateway;
pub use real_wx_pay_gateway::RealWxPayGateway;
