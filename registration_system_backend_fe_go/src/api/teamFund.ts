import { request } from "./client";

export interface AdminCreditTeamFundPayload {
  team_id: number;
  user_id: number;
  amount_cents: number;
  note?: string;
  /** 幂等键：同一键重试只记一笔；不传则后端每次独立记账。 */
  idempotency_key?: string;
}

export interface AdminManualFundResult {
  balance_cents: number;
  transaction_id: number;
  duplicated?: boolean;
}

/** 管理员手动给队员队费余额充值（登记实际收到的线下款项，纯记账，无支付）。 */
export function adminCreditTeamFund(payload: AdminCreditTeamFundPayload) {
  return request<AdminManualFundResult>("/team-fund/credits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AdminConsumeTeamFundPayload {
  team_id: number;
  user_id: number;
  amount_cents: number;
  /** 消费原因（必填），保证流水可追溯。 */
  note: string;
  idempotency_key?: string;
}

/** 管理员手动消费扣费：扣减队员队费余额（允许扣成负数即欠款），不改会员身份。 */
export function adminConsumeTeamFund(payload: AdminConsumeTeamFundPayload) {
  return request<AdminManualFundResult>("/team-fund/consumptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AdminReverseTeamFundPayload {
  team_id: number;
  user_id: number;
  original_transaction_id: number;
  note: string;
  idempotency_key?: string;
}

/** 冲正人工记账错误：反向回加/扣回原金额并关联原流水，不删除历史。 */
export function adminReverseTeamFund(payload: AdminReverseTeamFundPayload) {
  return request<AdminManualFundResult>("/team-fund/reversals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface TeamFundTransactionItem {
  id: number;
  team_id: number;
  team_name?: string | null;
  amount_cents: number;
  balance_after_cents: number;
  source: string;
  description: string;
  created_at: string;
  created_by_user_id?: number | null;
  reversed_by_transaction_id?: number | null;
  match_id?: string | null;
  match_name?: string | null;
}

/** 查看指定成员的队费流水（冲正需定位原流水 ID）。 */
export function listMemberTeamFundTransactions(
  teamID: number,
  userID: number,
  beforeID = 0,
  limit = 30,
) {
  const query = `?before_id=${beforeID}&limit=${limit}`;
  return request<TeamFundTransactionItem[]>(
    `/teams/${teamID}/members/${userID}/fund-transactions${query}`,
  );
}
