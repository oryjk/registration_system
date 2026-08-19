import type {
  BackendCancelOrderResult,
  BackendPaymentOrder,
  BackendPaymentOrderResult,
  BackendPaymentOrderStatus,
  BackendSyncOrderStatusResult,
} from "@/types/backend";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

export function createRechargeOrder(payload: {
  amount: string | number;
  openid?: string;
}) {
  return requestApi<BackendPaymentOrderResult>({
    url: "/payment/recharge",
    method: "POST",
    data: payload,
    auth: true,
  });
}

export interface GoPaymentOrderResult {
  order: {
    order_no: string;
    kind: string;
    amount_cents: number;
    status: string;
  };
  payment: Record<string, unknown> | null;
}

/** 为球队创建队费订单并发起微信支付（任意金额，与时间无关）；仅该队队长/领队可操作。 */
export function createTeamMembershipOrder(payload: { team_id: number; amount_cents: number }) {
  return requestApi<GoPaymentOrderResult>({
    url: "/payments/team-membership-orders",
    method: "POST",
    data: payload,
    auth: true,
  });
}

/** 为比赛报名创建报名费订单并发起微信支付；金额由比赛定价，仅赛前支付且未支付时可下单。 */
export function createMatchRegistrationOrder(payload: { match_id: string }) {
  return requestApi<GoPaymentOrderResult>({
    url: "/payments/match-registration-orders",
    method: "POST",
    data: payload,
    auth: true,
  });
}

/** 为"请开发者喝咖啡"创建打赏订单并发起微信支付；可选功能建议随订单提交，支付成功后才生效。 */
export function createTipOrder(payload: { amount_cents: number; suggestion?: string }) {
  return requestApi<GoPaymentOrderResult>({
    url: "/payments/tip-orders",
    method: "POST",
    data: payload,
    auth: true,
  });
}

/** 轮询 Go 支付订单状态（微信回调后置为已付）。 */
export function syncGoPaymentOrder(orderNo: string) {
  return requestApi<{ order: { order_no: string; status: string } }>({
    url: `/payments/orders/${orderNo}/sync`,
    method: "POST",
    auth: true,
  });
}

export function createChallengeIndividualPaymentOrder(payload: {
  challenge_id: string;
  openid?: string;
}) {
  return requestApi<BackendPaymentOrderResult>({
    url: "/payment/challenge-individual",
    method: "POST",
    data: payload,
    auth: true,
  });
}

export function getPaymentOrderStatus(orderNo: string) {
  return requestApi<BackendPaymentOrderStatus>({
    url: `/payment/order/${orderNo}`,
    auth: true,
  });
}

export function listPaymentOrders(params?: { limit?: number }) {
  const queryString = buildQueryString({ limit: params?.limit });
  return requestApi<BackendPaymentOrder[]>({
    url: `/payment/orders${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}

export function syncPaymentOrderStatus(orderNo: string) {
  return requestApi<BackendSyncOrderStatusResult>({
    url: `/payment/sync/${orderNo}`,
    method: "POST",
    auth: true,
  });
}

export function cancelPaymentOrder(orderNo: string) {
  return requestApi<BackendCancelOrderResult>({
    url: "/payment/cancel",
    method: "POST",
    data: {
      order_no: orderNo,
    },
    auth: true,
  });
}
