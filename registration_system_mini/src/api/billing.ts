import type {
  BackendBillingFlowResult,
  BackendUserAccount,
} from "@/types/backend";
import { requestApi } from "@/utils/request";

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
