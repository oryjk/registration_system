import type { AppMatchSummary } from "@/types/match";

export type DetailAction = "pay" | "individual" | "roster";

/** 展示层只选择已有业务入口，不自行推导支付资格或修改权限。 */
export function resolveDetailActions(input: {
  closed: boolean;
  pendingPayment: boolean;
  pickup: boolean;
  hasRoster: boolean;
  paid: boolean;
}): { primary: DetailAction | null; secondary: DetailAction | null } {
  const registration = input.closed || (input.pickup && input.paid)
    ? null : input.pickup || !input.hasRoster ? "individual" : "roster";
  return input.pendingPayment
    ? { primary: "pay", secondary: registration }
    : { primary: registration, secondary: null };
}

export function formatDetailFee(match: Pick<AppMatchSummary, "fee_per_person_cents" | "payment_mode"> | null): string {
  const cents = match?.fee_per_person_cents;
  if (cents == null || !Number.isFinite(cents) || cents < 0) return "费用待确认";
  if (cents === 0) return "免费";
  const timing = match?.payment_mode === "prepaid" ? " · 赛前支付"
    : match?.payment_mode === "postpaid" ? " · 赛后结算" : "";
  return `¥${(cents / 100).toFixed(2)}/人${timing}`;
}

/** 与首页一致：已开赛普通用户只查看；不参与付款资格判断。 */
export function isDetailRegistrationReadOnly(match: Pick<AppMatchSummary, "status" | "start_time"> | null, windowClosed: boolean, now: number): boolean {
  if (!match || windowClosed || match.status !== "registering") return true;
  const start = Date.parse(match.start_time);
  return Number.isFinite(start) && now >= start;
}
