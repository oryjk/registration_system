import { computed, ref, type ComputedRef, type Ref } from "vue";
import { getActivitySettlement } from "@/api/billing";
import { searchUsers } from "@/api/user";
import type {
  BackendActivity,
  BackendActivitySettlementSummary,
  BackendRegistration,
  BackendUser,
} from "@/types/backend";
import { submitMatchSettlement } from "./detailActions";
import {
  buildRegisteredAttendeeCharges,
  buildSettlementParticipants,
  createDefaultSettlementForm,
  patchSettlementFormFromSummary,
  validateSettlementForm,
} from "./settlementState";

interface MatchSettlementDependencies {
  match: Ref<BackendActivity | null>;
  registrations: Ref<BackendRegistration[]>;
  usersById: Ref<Record<number, BackendUser>>;
  canManageCurrentMatch: ComputedRef<boolean>;
  isEndedMatch: ComputedRef<boolean>;
  submittingStatus: Ref<boolean>;
  confirmRegistrationAction: (options: { title: string; content: string; confirmText?: string }) => Promise<boolean>;
}

export function useMatchSettlement(dependencies: MatchSettlementDependencies) {
  const {
    match,
    registrations,
    usersById,
    canManageCurrentMatch,
    isEndedMatch,
    submittingStatus,
    confirmRegistrationAction,
  } = dependencies;

  const settlementSummary = ref<BackendActivitySettlementSummary | null>(null);
  const settlementForm = ref(createDefaultSettlementForm());
  const settlementSearchKeyword = ref("");
  const settlementSearchResults = ref<BackendUser[]>([]);
  const settlementSearching = ref(false);

  const canShowSettlement = computed(() => isEndedMatch.value && canManageCurrentMatch.value);
  const settlementAttendeeCount = computed(() => registrations.value.filter((item) => item.stand === 1).length);
  const settlementParticipants = computed(() =>
    buildSettlementParticipants({
      charges: settlementForm.value.charges,
      usersById: usersById.value,
      summary: settlementSummary.value,
    }),
  );

  function syncRegisteredSettlementCharges() {
    if (settlementForm.value.participantScope !== "registered_attendees") return;
    settlementForm.value.charges = buildRegisteredAttendeeCharges(
      registrations.value,
      usersById.value,
      settlementForm.value.charges,
    );
  }

  function resetSettlementState() {
    settlementSummary.value = null;
    settlementForm.value = createDefaultSettlementForm();
    settlementSearchKeyword.value = "";
    settlementSearchResults.value = [];
  }

  async function loadSettlementSummaryIfAllowed() {
    if (!match.value || !canShowSettlement.value) {
      syncRegisteredSettlementCharges();
      return;
    }

    try {
      const summary = await getActivitySettlement(match.value.id);
      settlementSummary.value = summary;
      patchSettlementFormFromSummary(settlementForm.value, summary);
    } catch (_error) {
      settlementSummary.value = null;
    } finally {
      syncRegisteredSettlementCharges();
    }
  }

  function handleSettlementModeChange(event: Event) {
    const detail = event as Event & { detail?: { value?: number | string } };
    settlementForm.value.mode = Number(detail.detail?.value ?? 0) === 1 ? "manual" : "aa";
    syncRegisteredSettlementCharges();
  }

  function handleSettlementScopeChange(event: Event) {
    const detail = event as Event & { detail?: { value?: number | string } };
    settlementForm.value.participantScope =
      Number(detail.detail?.value ?? 0) === 1 ? "custom_users" : "registered_attendees";
    if (settlementForm.value.participantScope === "registered_attendees") {
      syncRegisteredSettlementCharges();
    } else {
      settlementForm.value.charges = [];
    }
  }

  function handleSettlementChargeAmountInput(userId: number, amount: string) {
    settlementForm.value.charges = settlementForm.value.charges.map((item) =>
      item.userId === userId ? { ...item, amount } : item,
    );
  }

  function handleRemoveSettlementCustomUser(userId: number) {
    settlementForm.value.charges = settlementForm.value.charges.filter((item) => item.userId !== userId);
  }

  async function handleSearchSettlementUsers() {
    const keyword = settlementSearchKeyword.value.trim();
    if (!keyword || settlementSearching.value) return;
    settlementSearching.value = true;
    try {
      settlementSearchResults.value = await searchUsers(keyword, 8);
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "搜索用户失败", icon: "none" });
    } finally {
      settlementSearching.value = false;
    }
  }

  function handleAddSettlementCustomUser(user: BackendUser) {
    if (settlementForm.value.charges.some((item) => item.userId === user.id)) {
      uni.showToast({ title: "该人员已在扣费名单中", icon: "none" });
      return;
    }

    usersById.value = { ...usersById.value, [user.id]: user };
    settlementForm.value.charges = [...settlementForm.value.charges, { userId: user.id, amount: "" }];
  }

  async function handleSubmitSettlement() {
    if (!match.value || submittingStatus.value) return;
    if (!canShowSettlement.value) {
      uni.showToast({ title: "比赛结束后由队长或领队结算", icon: "none" });
      return;
    }

    syncRegisteredSettlementCharges();
    const validationMessage = validateSettlementForm(settlementForm.value, settlementAttendeeCount.value);
    if (validationMessage) {
      uni.showToast({ title: validationMessage, icon: "none", duration: 2800 });
      return;
    }

    const confirmed = await confirmRegistrationAction({
      title: settlementSummary.value?.settled ? "确认重新结算" : "确认结算",
      content: settlementSummary.value?.settled
        ? "重新结算会先冲正当前有效批次，再生成新的扣费记录。"
        : "确认后会按当前设置扣除对应人员余额。",
      confirmText: settlementSummary.value?.settled ? "重新结算" : "确认结算",
    });
    if (!confirmed) return;

    submittingStatus.value = true;
    try {
      const payloadItems =
        settlementForm.value.participantScope === "custom_users" || settlementForm.value.mode === "manual"
          ? settlementForm.value.charges.map((item) => ({
              user_id: item.userId,
              amount: settlementForm.value.mode === "manual" ? item.amount : undefined,
            }))
          : [];
      const summary = await submitMatchSettlement(match.value.id, {
        total_amount: settlementForm.value.totalAmount,
        mode: settlementForm.value.mode,
        participant_scope: settlementForm.value.participantScope,
        items: payloadItems,
        description: settlementForm.value.description.trim() || undefined,
      });
      settlementSummary.value = summary;
      patchSettlementFormFromSummary(settlementForm.value, summary);
      syncRegisteredSettlementCharges();
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
    settlementSearchKeyword,
    settlementSearchResults,
    settlementSearching,
    canShowSettlement,
    settlementAttendeeCount,
    settlementParticipants,
    resetSettlementState,
    loadSettlementSummaryIfAllowed,
    handleSettlementModeChange,
    handleSettlementScopeChange,
    handleSettlementChargeAmountInput,
    handleRemoveSettlementCustomUser,
    handleSearchSettlementUsers,
    handleAddSettlementCustomUser,
    handleSubmitSettlement,
  };
}
