import { computed, ref, type ComputedRef, type Ref } from "vue";
import { getMatchSettlement, settleMatch } from "@/api/match";
import type { BackendActivity, BackendMatchSettlementSummary } from "@/types/backend";
import type { NeoConfirmDialogOptions } from "@/components/neo";
import {
  buildSettlementFormFromSummary,
  buildSettlementParticipants,
  createDefaultSettlementForm,
  settlementTotalCents,
  validateSettlementForm,
  yuanTextToCents,
} from "./settlementState";

interface MatchSettlementDependencies {
  match: Ref<BackendActivity | null>;
  canManageCurrentMatch: ComputedRef<boolean>;
  isEndedMatch: ComputedRef<boolean>;
  submittingStatus: Ref<boolean>;
  confirmRegistrationAction: (options: NeoConfirmDialogOptions) => Promise<boolean>;
}

/** 比赛结算：队长/领队在已结束比赛上按出场名单扣队费，支持冲正重算。 */
export function useMatchSettlement(dependencies: MatchSettlementDependencies) {
  const { match, canManageCurrentMatch, isEndedMatch, submittingStatus, confirmRegistrationAction } = dependencies;

  const settlementSummary = ref<BackendMatchSettlementSummary | null>(null);
  const settlementForm = ref(createDefaultSettlementForm());

  const canShowSettlement = computed(() => isEndedMatch.value && canManageCurrentMatch.value);
  const settlementParticipants = computed(() => buildSettlementParticipants(settlementForm.value));
  const settlementTotalLabel = computed(() => {
    const cents = settlementTotalCents(settlementForm.value);
    return Number.isFinite(cents) ? `¥${(cents / 100).toFixed(2)}` : "";
  });

  function resetSettlementState() {
    settlementSummary.value = null;
    settlementForm.value = createDefaultSettlementForm();
  }

  async function loadSettlementSummaryIfAllowed() {
    if (!match.value || !canShowSettlement.value) {
      settlementForm.value = createDefaultSettlementForm();
      return;
    }

    try {
      const summary = await getMatchSettlement(match.value.id);
      settlementSummary.value = summary;
      settlementForm.value = buildSettlementFormFromSummary(summary);
    } catch (_error) {
      settlementSummary.value = null;
      settlementForm.value = createDefaultSettlementForm();
    }
  }

  function handleSettlementChargeAmountInput(userId: number, amount: string) {
    settlementForm.value.charges = settlementForm.value.charges.map((item) =>
      item.userId === userId ? { ...item, amount } : item,
    );
  }

  async function handleSubmitSettlement() {
    if (!match.value || submittingStatus.value) return;
    if (!canShowSettlement.value) {
      uni.showToast({ title: "比赛结束后由队长或领队结算", icon: "none" });
      return;
    }

    const validationMessage = validateSettlementForm(settlementForm.value);
    if (validationMessage) {
      uni.showToast({ title: validationMessage, icon: "none", duration: 2800 });
      return;
    }

    const confirmed = await confirmRegistrationAction({
      title: settlementSummary.value?.settled ? "确认重新结算" : "确认结算",
      content: settlementSummary.value?.settled
        ? "重新结算会先冲正当前有效批次，再按新金额扣费。"
        : "确认后会按当前金额扣除对应队员的队费余额，余额不足将记为欠款。",
      confirmText: settlementSummary.value?.settled ? "重新结算" : "确认结算",
    });
    if (!confirmed) return;

    submittingStatus.value = true;
    try {
      await settleMatch(match.value.id, {
        items: settlementForm.value.charges.map((item) => ({
          user_id: item.userId,
          amount_cents: yuanTextToCents(item.amount || 0),
        })),
        description: settlementForm.value.description.trim() || undefined,
      });
      await loadSettlementSummaryIfAllowed();
      uni.showToast({ title: "结算已完成", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "结算失败", icon: "none", duration: 2800 });
    } finally {
      submittingStatus.value = false;
    }
  }

  return {
    settlementSummary,
    settlementForm,
    canShowSettlement,
    settlementParticipants,
    settlementTotalLabel,
    resetSettlementState,
    loadSettlementSummaryIfAllowed,
    handleSettlementChargeAmountInput,
    handleSubmitSettlement,
  };
}
