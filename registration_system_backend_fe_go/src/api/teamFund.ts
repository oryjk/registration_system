import { request } from "./client";

export interface AdminCreditTeamFundPayload {
  team_id: number;
  user_id: number;
  amount_cents: number;
  note?: string;
}

export interface AdminCreditTeamFundResult {
  balance_cents: number;
  transaction_id: number;
}

/** 管理员手动给队员队费余额充值（纯记账，无支付）。 */
export function adminCreditTeamFund(payload: AdminCreditTeamFundPayload) {
  return request<AdminCreditTeamFundResult>("/team-fund/credits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
