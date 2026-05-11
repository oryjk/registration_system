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

export function createTeamMembershipOrder(payload: {
  team_id: string;
  months: number;
  openid?: string;
  note?: string;
}) {
  return requestApi<BackendPaymentOrderResult>({
    url: "/payment/team-membership",
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
