import type { BackendMatchSettlementSummary } from "@/types/backend";

/** 结算表单：固定可扣名单 + 每人金额（元字符串，提交时转分）。 */
export interface SettlementChargeDraft {
  userId: number;
  userName: string;
  amount: string;
}

export interface SettlementFormState {
  description: string;
  charges: SettlementChargeDraft[];
}

export interface SettlementParticipantViewModel {
  userId: number;
  name: string;
  amount: string;
}

export function centsToYuanText(cents: number | null | undefined) {
  if (cents == null || !Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

export function yuanTextToCents(amount: string | number | null | undefined) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
}

export function createDefaultSettlementForm(): SettlementFormState {
  return { description: "", charges: [] };
}

/** 用结算摘要初始化表单：未结算时 items 为服务端预填的可扣名单（默认人均费）。 */
export function buildSettlementFormFromSummary(summary: BackendMatchSettlementSummary): SettlementFormState {
  return {
    description: summary.description || "",
    charges: summary.items.map((item) => ({
      userId: item.user_id,
      userName: item.user_name,
      amount: centsToYuanText(item.amount_cents),
    })),
  };
}

export function buildSettlementParticipants(form: SettlementFormState): SettlementParticipantViewModel[] {
  return form.charges.map((charge) => ({
    userId: charge.userId,
    name: charge.userName,
    amount: charge.amount,
  }));
}

export function settlementTotalCents(form: SettlementFormState) {
  return form.charges.reduce((total, charge) => total + (yuanTextToCents(charge.amount) || 0), 0);
}

/** 校验：每人金额 >= 0 且至少一人 > 0。 */
export function validateSettlementForm(form: SettlementFormState): string {
  if (form.charges.length === 0) {
    return "当前没有可扣费的出场队员";
  }
  let total = 0;
  for (const charge of form.charges) {
    const cents = yuanTextToCents(charge.amount || 0);
    if (!Number.isFinite(cents) || cents < 0) {
      return "每人金额需要是大于等于 0 的数字";
    }
    total += cents;
  }
  if (total <= 0) {
    return "结算总额需要大于 0";
  }
  return "";
}
