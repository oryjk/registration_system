import type { BackendTeamFundBalance, BackendTeamFundTransaction } from "@/types/backend";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

/** 我在各球队的队费余额（含欠款为负数的球队）。 */
export function getTeamFundBalances() {
  return requestApi<BackendTeamFundBalance[]>({
    url: "/team-fund/balances",
    auth: true,
  });
}

/** 我的队费流水（充值/扣费/冲正），按 id 倒序，beforeId 游标分页。 */
export function getTeamFundTransactions(params?: { limit?: number; beforeId?: number }) {
  const queryString = buildQueryString({ limit: params?.limit, before_id: params?.beforeId });
  return requestApi<BackendTeamFundTransaction[]>({
    url: `/team-fund/transactions${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}
