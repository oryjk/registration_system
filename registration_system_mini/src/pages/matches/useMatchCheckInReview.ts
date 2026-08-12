import { computed, ref, type ComputedRef, type Ref } from "vue";
import { saveMatchCheckInConfig, submitMatchActivityReview, submitMatchCheckIn } from "./detailActions";
import type { BackendActivity, BackendRegistration, BackendTeam, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { applyCheckInPatch } from "./detailState";

interface CheckInConfigDraft {
  enabled: boolean;
  radiusMeters: number;
  openMinutesBefore: number;
  closeMinutesAfter: number;
}

interface MatchCheckInReviewDependencies {
  match: Ref<BackendActivity | null>;
  registrations: Ref<BackendRegistration[]>;
  currentUser: Ref<BackendUser | null>;
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  opponentTeam: ComputedRef<BackendTeam | null>;
  isGoMatchDetail: Ref<boolean>;
  isEndedMatch: ComputedRef<boolean>;
  submittingStatus: Ref<boolean>;
  ensureCurrentLocation: () => Promise<{ latitude: number; longitude: number } | null>;
}

export function useMatchCheckInReview(dependencies: MatchCheckInReviewDependencies) {
  const {
    match,
    registrations,
    currentUser,
    currentTeam,
    opponentTeam,
    isGoMatchDetail,
    isEndedMatch,
    submittingStatus,
    ensureCurrentLocation,
  } = dependencies;

  const checkInForm = ref<CheckInConfigDraft>({
    enabled: false,
    radiusMeters: 200,
    openMinutesBefore: 60,
    closeMinutesAfter: 45,
  });
  const reviewForm = ref({ rating: 5, comment: "" });
  const reviewSubmitted = ref(false);

  const currentTeamCheckInConfig = computed(() => {
    const teamId = currentTeam.value?.id;
    if (!teamId || !match.value) return null;
    return match.value.team_checkin_configs.find((item) => item.team_id === teamId) ?? null;
  });
  const isDerivedTeamSignupActivity = computed(() => !!match.value?.source_activity_id);
  const hasCheckedIn = computed(() => {
    const userId = currentUser.value?.id;
    return !!registrations.value.find((item) => item.user_id === userId && item.checked_in_at);
  });
  const canShowCheckIn = computed(
    () => !isGoMatchDetail.value && !isDerivedTeamSignupActivity.value && !!currentTeamCheckInConfig.value?.enabled && !!currentTeam.value,
  );
  const canManageCurrentMatch = computed(
    () => !isGoMatchDetail.value && !isDerivedTeamSignupActivity.value && !!currentTeam.value?.canManageTeam,
  );
  const canSubmitActivityReview = computed(
    () => !!currentTeam.value && !!opponentTeam.value && isEndedMatch.value && canManageCurrentMatch.value && !reviewSubmitted.value,
  );
  const canShowActivityReview = computed(
    () => !!currentTeam.value && !!opponentTeam.value && isEndedMatch.value && canManageCurrentMatch.value,
  );

  function resetCheckInReviewState(config?: Partial<CheckInConfigDraft> | null) {
    checkInForm.value = {
      enabled: config?.enabled ?? false,
      radiusMeters: config?.radiusMeters ?? 200,
      openMinutesBefore: config?.openMinutesBefore ?? 60,
      closeMinutesAfter: config?.closeMinutesAfter ?? 45,
    };
    reviewForm.value = { rating: 5, comment: "" };
    reviewSubmitted.value = false;
  }

  function handleCheckInSwitchChange(event: Event) {
    const detail = event as Event & { detail?: { value?: boolean } };
    checkInForm.value = { ...checkInForm.value, enabled: !!detail.detail?.value };
  }

  function handleReviewRatingChange(event: Event) {
    const detail = event as Event & { detail?: { value?: number | string } };
    reviewForm.value = { ...reviewForm.value, rating: Number(detail.detail?.value ?? 0) + 1 };
  }

  async function handleCheckIn() {
    if (!match.value || !currentTeam.value || submittingStatus.value) return;
    if (!canShowCheckIn.value) {
      uni.showToast({ title: "当前比赛未开启签到", icon: "none" });
      return;
    }
    if (hasCheckedIn.value) {
      uni.showToast({ title: "你已经签到过了", icon: "none" });
      return;
    }

    submittingStatus.value = true;
    try {
      const location = await ensureCurrentLocation();
      if (!location) throw new Error("未获取到当前位置");
      const record = await submitMatchCheckIn({
        activityId: match.value.id,
        teamId: currentTeam.value.id,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      registrations.value = applyCheckInPatch(registrations.value, record);
      uni.showToast({ title: "签到成功", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "签到失败", icon: "none" });
    } finally {
      submittingStatus.value = false;
    }
  }

  async function handleSaveCheckInConfig() {
    if (!match.value || !currentTeam.value || submittingStatus.value) return;
    if (!canManageCurrentMatch.value) {
      uni.showToast({ title: "只有队长或领队可以修改签到设置", icon: "none" });
      return;
    }

    submittingStatus.value = true;
    try {
      match.value = await saveMatchCheckInConfig({
        activityId: match.value.id,
        teamId: currentTeam.value.id,
        enabled: checkInForm.value.enabled,
        radiusMeters: Number(checkInForm.value.radiusMeters),
        openMinutesBefore: Number(checkInForm.value.openMinutesBefore),
        closeMinutesAfter: Number(checkInForm.value.closeMinutesAfter),
      });
      uni.showToast({ title: "签到设置已保存", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "签到设置保存失败", icon: "none" });
    } finally {
      submittingStatus.value = false;
    }
  }

  async function handleSubmitActivityReview() {
    if (!match.value || !currentTeam.value || submittingStatus.value) return;
    if (!canSubmitActivityReview.value) {
      uni.showToast({ title: "比赛结束后由队长提交互评", icon: "none" });
      return;
    }

    submittingStatus.value = true;
    try {
      await submitMatchActivityReview({
        teamId: currentTeam.value.id,
        activityId: match.value.id,
        rating: reviewForm.value.rating,
        comment: reviewForm.value.comment.trim() || undefined,
      });
      reviewSubmitted.value = true;
      uni.showToast({ title: "赛后互评已提交", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "互评提交失败", icon: "none" });
    } finally {
      submittingStatus.value = false;
    }
  }

  return {
    checkInForm,
    reviewForm,
    reviewSubmitted,
    hasCheckedIn,
    canShowCheckIn,
    canManageCurrentMatch,
    canShowActivityReview,
    canSubmitActivityReview,
    resetCheckInReviewState,
    handleCheckIn,
    handleCheckInSwitchChange,
    handleSaveCheckInConfig,
    handleReviewRatingChange,
    handleSubmitActivityReview,
  };
}
