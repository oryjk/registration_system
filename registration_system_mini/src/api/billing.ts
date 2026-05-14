import type {
  BackendActivitySettlementSummary,
  BackendBillingFlowResult,
  BackendSettlementMode,
  BackendSettlementParticipantScope,
  BackendUserAccount,
} from "@/types/backend";
import { requestApi } from "@/utils/request";

export interface SettleActivityExpensePayload extends Record<string, unknown> {
  total_amount: string | number;
  mode: BackendSettlementMode;
  participant_scope: BackendSettlementParticipantScope;
  items?: Array<{
    user_id: number;
    amount?: string | number | null;
  }>;
  description?: string;
}

export function getMyBalance() {
  return requestApi<BackendUserAccount | null>({
    url: "/account/balance",
    auth: true,
  });
}

export function getMyBillingFlow() {
  return requestApi<BackendBillingFlowResult>({
    url: "/order/my-billing-flow",
    auth: true,
  });
}

export function getActivitySettlement(activityId: string) {
  return requestApi<BackendActivitySettlementSummary>({
    url: `/order/activities/${activityId}/settlement`,
    auth: true,
  });
}

export function settleActivityExpense(activityId: string, payload: SettleActivityExpensePayload) {
  return requestApi<BackendActivitySettlementSummary>({
    url: `/order/activities/${activityId}/settlement`,
    method: "POST",
    data: payload,
    auth: true,
  });
}
