import type {
  BackendPaymentOrder,
  BackendPaymentOrderListResult,
  BackendPaymentOrderResult,
  BackendSyncOrderStatusResult,
} from "@/types/backend";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

/** 创建钱包充值订单并发起微信支付；金额以分为单位。 */
export function createRechargeOrder(payload: { amount_cents: number }) {
  return requestApi<BackendPaymentOrderResult>({
    url: "/payments/recharge-orders",
    method: "POST",
    data: payload,
    auth: true,
  });
}

/** 为球队创建队费订单并发起微信支付（任意金额）；仅该队队长/领队可操作。 */
export function createTeamMembershipOrder(payload: { team_id: number; amount_cents: number }) {
  return requestApi<BackendPaymentOrderResult>({
    url: "/payments/team-membership-orders",
    method: "POST",
    data: payload,
    auth: true,
  });
}

/** 为比赛报名创建报名费订单并发起微信支付；金额由比赛定价，仅赛前支付且未支付时可下单。 */
export function createMatchRegistrationOrder(payload: { match_id: string }) {
  return requestApi<BackendPaymentOrderResult>({
    url: "/payments/match-registration-orders",
    method: "POST",
    data: payload,
    auth: true,
  });
}

/** 为"请开发者喝咖啡"创建打赏订单并发起微信支付；可选功能建议随订单提交。 */
export function createTipOrder(payload: { amount_cents: number; suggestion?: string }) {
  return requestApi<BackendPaymentOrderResult>({
    url: "/payments/tip-orders",
    method: "POST",
    data: payload,
    auth: true,
  });
}

/** 我的支付订单列表（微信回调后置为已付）。 */
export function listPaymentOrders(params?: { page?: number; pageSize?: number }) {
  const queryString = buildQueryString({ page: params?.page, page_size: params?.pageSize });
  return requestApi<BackendPaymentOrderListResult>({
    url: `/payments/orders${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}

export function getPaymentOrder(orderNo: string) {
  return requestApi<BackendPaymentOrder>({
    url: `/payments/orders/${orderNo}`,
    auth: true,
  });
}

/** 主动查单核销（支付回调延迟时轮询）。 */
export function syncGoPaymentOrder(orderNo: string) {
  return requestApi<BackendSyncOrderStatusResult>({
    url: `/payments/orders/${orderNo}/sync`,
    method: "POST",
    auth: true,
  });
}

/** syncGoPaymentOrder 的旧命名别名，兼容既有调用点。 */
export function syncPaymentOrderStatus(orderNo: string) {
  return syncGoPaymentOrder(orderNo);
}

export function cancelPaymentOrder(orderNo: string) {
  return requestApi<BackendPaymentOrder>({
    url: `/payments/orders/${orderNo}/cancel`,
    method: "POST",
    auth: true,
  });
}
