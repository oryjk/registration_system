import type {
  BackendActivitySettlementSummary,
  BackendRegistration,
  BackendSettlementMode,
  BackendSettlementParticipantScope,
  BackendUser,
} from "@/types/backend";
import { resolveUserDisplayName } from "@/utils/viewModels";

export interface SettlementChargeDraft {
  userId: number;
  amount: string;
}

export interface SettlementFormState {
  totalAmount: string;
  description: string;
  mode: BackendSettlementMode;
  participantScope: BackendSettlementParticipantScope;
  charges: SettlementChargeDraft[];
}

export interface SettlementParticipantViewModel {
  userId: number;
  name: string;
  avatarUrl: string;
  amount: string;
}

export function createDefaultSettlementForm(): SettlementFormState {
  return {
    totalAmount: "",
    description: "赛后 AA 扣费",
    mode: "aa",
    participantScope: "registered_attendees",
    charges: [],
  };
}

export function currencyLabel(value: string | number | null | undefined) {
  if (value == null || value === "") return "¥0.00";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "¥0.00";
  return `¥${amount.toFixed(2)}`;
}

export function settlementModeLabel(mode: string | null | undefined) {
  return mode === "manual" ? "手动金额" : "AA 平摊";
}

export function settlementScopeLabel(scope: string | null | undefined) {
  return scope === "custom_users" ? "自定义人员" : "参加名单";
}

export function normalizeAmountText(value: string | number | null | undefined) {
  if (value == null || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return amount.toFixed(2).replace(/\.00$/, "");
}

export function buildRegisteredAttendeeCharges(
  registrations: BackendRegistration[],
  usersById: Record<number, BackendUser>,
  existingCharges: SettlementChargeDraft[],
): SettlementChargeDraft[] {
  const existingByUserId = new Map(existingCharges.map((item) => [item.userId, item.amount]));
  return registrations
    .filter((item) => item.stand === 1)
    .map((item) => ({
      userId: item.user_id,
      amount: existingByUserId.get(item.user_id) ?? "",
    }))
    .sort((left, right) =>
      resolveUserDisplayName(usersById[left.userId]).localeCompare(
        resolveUserDisplayName(usersById[right.userId]),
        "zh-CN",
      ),
    );
}

export function buildSettlementParticipants(params: {
  charges: SettlementChargeDraft[];
  usersById: Record<number, BackendUser>;
  summary?: BackendActivitySettlementSummary | null;
}): SettlementParticipantViewModel[] {
  const summaryItemByUserId = new Map((params.summary?.items ?? []).map((item) => [item.user_id, item]));

  return params.charges.map((charge) => {
    const user = params.usersById[charge.userId];
    const summaryItem = summaryItemByUserId.get(charge.userId);
    return {
      userId: charge.userId,
      name: summaryItem?.user_name || resolveUserDisplayName(user),
      avatarUrl: user?.avatar_url ?? "",
      amount: charge.amount || normalizeAmountText(summaryItem?.fee),
    };
  });
}

export function patchSettlementFormFromSummary(
  form: SettlementFormState,
  summary: BackendActivitySettlementSummary,
) {
  if (!form.totalAmount && summary.total_amount) {
    form.totalAmount = normalizeAmountText(summary.total_amount);
  }
  if ((!form.description || form.description === "赛后 AA 扣费") && summary.description) {
    form.description = summary.description;
  }
  if (summary.mode === "manual" || summary.mode === "aa") {
    form.mode = summary.mode;
  }
  if (summary.participant_scope === "custom_users" || summary.participant_scope === "registered_attendees") {
    form.participantScope = summary.participant_scope;
  }
  if (summary.items.length > 0) {
    form.charges = summary.items.map((item) => ({
      userId: item.user_id,
      amount: normalizeAmountText(item.fee),
    }));
  }
}

export function validateSettlementForm(form: SettlementFormState, attendeeCount: number) {
  const totalAmount = Number(form.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return "请输入大于 0 的结算总金额";
  }

  const participantCount =
    form.participantScope === "registered_attendees" ? attendeeCount : form.charges.length;
  if (participantCount <= 0) {
    return form.participantScope === "custom_users" ? "请先选择扣费人员" : "当前没有参加人员";
  }

  if (form.mode === "manual") {
    const invalid = form.charges.find((item) => {
      const amount = Number(item.amount);
      return !Number.isFinite(amount) || amount <= 0;
    });
    if (invalid) return "手动金额需要给每个人填写大于 0 的金额";

    const chargeTotal = form.charges.reduce((sum, item) => sum + Number(item.amount), 0);
    if (Math.abs(chargeTotal - totalAmount) > 0.01) {
      return "手动金额合计需要等于结算总金额";
    }
  }

  return "";
}
