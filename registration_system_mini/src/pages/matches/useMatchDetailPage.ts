import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { MATCH_API_ID_PATTERN, loadAuthenticatedMatchDetailContext, loadPublicMatchDetailData, toRegistrationStandCode, type MatchTeamGroupSummary } from "./detailData";
import { useMatchRegistrationPayment } from "./useMatchRegistrationPayment";
import { useCurrentLocation } from "@/stores/currentLocation";
import { useTeamContext } from "@/stores/teamContext";
import { canShowTeamRegistrationTab } from "./registrationVisibility";
import { hasManualLogout } from "@/utils/authStorage";
import type {
  BackendActivity,
  BackendRegistration,
  BackendTeam,
  BackendTeamMember,
  BackendUser,
} from "@/types/backend";
import type { AppMatchSummary } from "@/types/match";
import { getCustomNavMetrics } from "@/utils/customNav";
import { resolveInheritedGuestLimit } from "@/utils/matchCapacity";
import type { MatchTeamProgressItem } from "@/types/viewModels";
import { resolveUserDisplayName, toStandLabel } from "@/utils/viewModels";
import {
  avatarColor,
  byRegistrationTimeAsc,
  buildRemainingPlayersLabel,
  buildTeamMemberRegistrationGroups,
  clampTeamRegistrationCount,
  describeDaysUntil,
  formatClock,
  formatCountdown,
  formatMonthDay,
  formatWeekday,
  parseDateValue,
  resolveRegistrationCapacityState,
  resolveRegistrationWindow,
} from "./detailState";
import { useMatchRegistration } from "./useMatchRegistration";
import { useMatchGuestLogin } from "./useMatchGuestLogin";
import { useMatchCheckInReview } from "./useMatchCheckInReview";
import { useMatchSettlement } from "./useMatchSettlement";
import { useMatchFinish } from "./useMatchFinish";
import { useNeoConfirmDialog } from "@/components/neo";
import type { NeoConfirmDialogOptions } from "@/components/neo";

export function useMatchDetailPage() {
  const { currentTeam, currentUser, ensureSessionReady } = useTeamContext();
  const { ensureCurrentLocation } = useCurrentLocation();
  const {
    confirmDialogVisible,
    confirmDialogState,
    confirm: openConfirmDialog,
    handleConfirmPrimary,
    handleConfirmSecondary,
    handleConfirmClose,
  } = useNeoConfirmDialog();

  const navMetrics = getCustomNavMetrics();
  const matchId = ref("");
  const isLoading = ref(false);
  const errorMessage = ref("");
  const submittingStatus = ref(false);
  const registrationMode = ref<"individual" | "team">("individual");
  const match = ref<BackendActivity | null>(null);
  // 新比赛接口的原始对象：接约申请管理依赖 publication_mode / opponent_state，转换后的 activity 不带这些字段。
  const sourceMatch = ref<AppMatchSummary | null>(null);
  // 球队约队的主/客队报名分组（双方各自的进度）。
  const matchTeamGroups = ref<MatchTeamGroupSummary[]>([]);
  const registrations = ref<BackendRegistration[]>([]);
  const usersById = ref<Record<number, BackendUser>>({});
  const teamsById = ref<Record<number, BackendTeam>>({});
  const currentTeamMembers = ref<BackendTeamMember[]>([]);
  const sourceTeamRegistrationCount = ref(0);
  const existingTeamDerivedActivity = ref<BackendActivity | null>(null);
  const currentStatus = ref("待定");
  const nowTick = ref(Date.now());
  const teamRegistrationCount = ref(5);
  const isGuestMode = ref(false);
  const isMatchApiDetail = ref(false);
  const registrationGroupId = ref("");
  const preferredRegistrationGroupId = ref("");
  const publicationModeLabel = ref("其他类型");
  const selectedGroupMinPlayers = ref<number | null>(null);

  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  // 底部留白复用全局 token：悬浮操作栏占位 + 与内容间距，兼容全面屏安全区。
  const pageStyle = computed(() => ({
    paddingBottom: "var(--neo-action-bar-clearance)",
  }));

  const contentStyle = computed(() => ({
    paddingTop: `${navMetrics.pageTopPadding + 8}px`,
  }));

  const joinedRegistrations = computed(() => registrations.value.filter((item) => item.stand === 1));
  // 报名人数按人头计：散人约球一人可代多人（registration_count > 1）。
  const joinedCount = computed(() =>
    joinedRegistrations.value.reduce((total, item) => total + item.registration_count, 0) + sourceTeamRegistrationCount.value,
  );
  // 本人当前报名占用的人数；散人约球调整人数面板用它预填与计算费用。
  const myRegistrationCount = computed(() =>
    registrations.value.find((item) => item.user_id === currentUser.value?.id && item.stand === 1)?.registration_count ?? 1,
  );
  const isPickupMatch = computed(() => sourceMatch.value?.publication_mode === "online_pickup");
  const requiredPlayers = computed(() => match.value?.players_per_team ?? 0);
  const progressTargetPlayers = computed(() => (isPickupMatch.value ? selectedGroupMinPlayers.value ?? 0 : requiredPlayers.value));
  const maxPlayers = computed(() => {
    const configuredCapacity = match.value?.team_capacity_limit;
    if (!Number.isFinite(configuredCapacity) || (configuredCapacity ?? 0) <= 0) {
      return requiredPlayers.value;
    }
    return Math.max(configuredCapacity ?? requiredPlayers.value, requiredPlayers.value);
  });

  const remainingPlayersLabel = computed(() => buildRemainingPlayersLabel(joinedCount.value, progressTargetPlayers.value));
  const registrationCapacityState = computed(() =>
    resolveRegistrationCapacityState({
      joinedCount: joinedCount.value,
      teamCapacityLimit: match.value?.team_capacity_limit,
      currentStatus: currentStatus.value,
    }),
  );
  const canSubmitIndividualRegistration = computed(() => !registrationCapacityState.value.isFull);

  const dateLine = computed(() => {
    if (!match.value) return "";
    return `${formatMonthDay(match.value.holding_date)} ${formatWeekday(match.value.holding_date)} ${formatClock(match.value.holding_date)}`;
  });
  const matchClockLabel = computed(() => (match.value ? formatClock(match.value.holding_date) : ""));

  const matchStartTimestamp = computed(() => {
    if (!match.value) return 0;
    return parseDateValue(match.value.holding_date).getTime();
  });

  const registrationWindow = computed(() => {
    if (!match.value) {
      return { state: "closed" as const, countdownTarget: null };
    }
    if (sourceMatch.value) {
      return resolveRegistrationWindow({
        now: nowTick.value,
        isRegistering: sourceMatch.value.status === "registering",
        registrationStartAt: sourceMatch.value.registration_start_at,
        registrationEndAt: sourceMatch.value.registration_end_at,
      });
    }
    return resolveRegistrationWindow({
      now: nowTick.value,
      isRegistering: match.value.status === 0,
      registrationStartAt: match.value.registration_start_at,
      // legacy 活动没有独立窗口时，end_time 仍代表原有报名截止时间。
      registrationEndAt: match.value.registration_end_at || match.value.end_time || match.value.holding_date,
    });
  });

  const registrationWindowState = computed(() => registrationWindow.value.state);
  const isRegistrationClosed = computed(() => registrationWindowState.value !== "open");

  const {
    myRegistrationPaid,
    submittingPayment,
    requiresPrepaidPayment,
    pendingPaymentFeeLabel,
    applyMyRegistrationPaid,
    payRegistrationFee,
  } = useMatchRegistrationPayment({ match, sourceMatch, currentStatus, myRegistrationCount });

  // 散人约球报名人数面板：选择人数（含代报）后提交，费用按人数合计。
  const signupSheetVisible = ref(false);
  const signupMaxCount = computed(() => Math.max(
    maxPlayers.value - joinedCount.value + (currentStatus.value === "参加" ? myRegistrationCount.value : 0),
    1,
  ));
  const feePerPersonLabel = computed(() => {
    const cents = sourceMatch.value?.fee_per_person_cents ?? 0;
    return cents > 0 ? `¥${(cents / 100).toFixed(2)}` : "";
  });
  function openSignupSheet() {
    signupSheetVisible.value = true;
  }
  function closeSignupSheet() {
    signupSheetVisible.value = false;
  }
  const countdownText = computed(() => {
    const window = registrationWindow.value;
    if (window.state === "closed") return "报名已结束";
    if (window.countdownTarget === null) return "报名进行中";
    const countdown = formatCountdown(window.countdownTarget - nowTick.value);
    return window.state === "not_started" ? `距开放 ${countdown}` : `距截止 ${countdown}`;
  });

  const heroMetaChips = computed(() => {
    if (!match.value) return [];
    return [
      requiredPlayers.value ? `${requiredPlayers.value}人制` : "人数待定",
      describeDaysUntil(matchStartTimestamp.value, nowTick.value),
      "免费报名",
    ];
  });

  const participantPreview = computed(() =>
    [...joinedRegistrations.value].sort(byRegistrationTimeAsc).map((item) => {
      // 刚报名时 usersById 还没有当前用户（接口只带已有参赛者），回退到会话资料，
      // 保证报名成功后头像和昵称立即可见，不用等刷新。
      const user = usersById.value[item.user_id]
        ?? (item.user_id === currentUser.value?.id ? currentUser.value : undefined);
      const displayName = resolveUserDisplayName(user);
      return {
        id: item.user_id,
        name: item.registration_count > 1 ? `${displayName}（${item.registration_count}人）` : displayName,
        avatarUrl: user?.avatar_url ?? "",
        tone: avatarColor(item.user_id),
      };
    }),
  );
  const registrationByUserId = computed(() => Object.fromEntries(registrations.value.map((item) => [item.user_id, item])));

  // 球队约队展示双边进度：主队/客队各一条，label 优先用真实队名。
  const teamProgressItems = computed<MatchTeamProgressItem[]>(() => {
    const match = sourceMatch.value;
    if (!match || match.publication_mode !== "online_team") return [];
    const hostGroup = matchTeamGroups.value.find((group) => group.kind === "host_team");
    return matchTeamGroups.value.map((group) => ({
      id: group.id,
      label: group.kind === "host_team"
        ? (group.teamId === match.host_team_id ? match.host_team_name : "主队")
        : (group.teamId === match.away_team_id && match.away_team_name ? match.away_team_name : "客队"),
      attending: group.attendingCount,
      // 客队上限未配置时继承主队（主客同制），规则与约队大厅列表共用。
      required: group.kind === "guest_team"
        ? resolveInheritedGuestLimit(hostGroup?.minPlayers ?? null, group.minPlayers)
        : group.minPlayers,
      max: group.kind === "guest_team"
        ? resolveInheritedGuestLimit(hostGroup?.maxPlayers ?? null, group.maxPlayers)
        : group.maxPlayers,
    }));
  });
  const activeTeamMembers = computed(() => currentTeamMembers.value.filter((member) => member.status === 1));
  const teamMemberRegistrationGroups = computed(() => buildTeamMemberRegistrationGroups({
    members: activeTeamMembers.value,
    registrations: registrations.value,
    usersById: usersById.value,
    currentUserId: currentUser.value?.id,
  }));

  const matchKindLabel = computed(() => publicationModeLabel.value);
  // 主队取约队队名（legacy 队内活动用当前球队兜底）；散人约球无球队概念，主客队统一「待定」。
  const homeTeamLabel = computed(() => (isPickupMatch.value ? "待定" : sourceMatch.value?.host_team_name || currentTeam.value?.name || "主队"));
  const displayOpponentLabel = computed(() => (isPickupMatch.value ? "待定" : match.value?.opposing || opponentTeam.value?.name || "对手待定"));
  const homeTeamColor = computed(() => match.value?.color?.trim() || "#FFFFFF");
  const awayTeamColor = computed(() => match.value?.opposing_color?.trim() || "#FF0000");
  const matchLocation = computed(() => match.value?.location || "");

  const opponentTeam = computed(() => {
    if (!match.value || !currentTeam.value) return null;
    const teamIds = [match.value.home_team_id, match.value.away_team_id].filter(
      (value): value is number => typeof value === "number",
    );
    const opponentId = teamIds.find((teamId) => teamId !== currentTeam.value?.id);
    return opponentId ? teamsById.value[opponentId] ?? null : null;
  });

  const individualCtaLabel = computed(() => {
    if (isGuestMode.value) return "登录后报名";
    if (registrationCapacityState.value.isFull && currentStatus.value !== "参加") return "报名已满";
    if (currentStatus.value !== "参加") return "立即报名";
    // 散人约球已报名：已支付锁定为只读，未支付可调整人数。
    if (isPickupMatch.value && isMatchApiDetail.value) return myRegistrationPaid.value ? "已报名" : "调整人数";
    return "取消报名";
  });
  const canUseTeamRegistration = computed(() =>
    !isMatchApiDetail.value && canShowTeamRegistrationTab({
      currentTeamId: currentTeam.value?.id,
      canManageTeam: currentTeam.value?.canManageTeam,
      sourceActivityId: match.value?.source_activity_id,
      homeTeamId: match.value?.home_team_id,
    }),
  );
  const teamRegistrationCountOptions = Array.from({ length: 7 }, (_, index) => {
    const value = index + 5;
    return { value, label: `${value} 人制` };
  });
  const teamSubmitLabel = computed(() =>
    existingTeamDerivedActivity.value ? "取消球队报名" : `发起球队报名（${teamRegistrationCount.value} 人）`,
  );
  const teamSignupHint = computed(() =>
    existingTeamDerivedActivity.value
      ? "取消后会关闭本球队对应的队内报名，首页进度会同步减少这组报名人数。"
      : "发起后会为当前球队创建一场独立报名，队员可在首页进入个人报名。",
  );
  const teamFormTitle = computed(() => (existingTeamDerivedActivity.value ? "球队已报名" : "发起球队报名"));
  const isEndedMatch = computed(() => match.value?.status === 2 || (matchStartTimestamp.value > 0 && nowTick.value > matchStartTimestamp.value));

  function openMatchLocation() {
    if (!match.value || match.value.location_latitude == null || match.value.location_longitude == null) {
      uni.showToast({
        title: "暂无可打开的地图定位",
        icon: "none",
      });
      return;
    }

    uni.openLocation({
      latitude: Number(match.value.location_latitude),
      longitude: Number(match.value.location_longitude),
      name: match.value.name,
      address: match.value.location,
    });
  }

  function confirmRegistrationAction(options: NeoConfirmDialogOptions) {
    return openConfirmDialog(options);
  }

  const {
    isGuestLoginSubmitting,
    handleGuestLogin,
    handleSessionLoginCompleted,
  } = useMatchGuestLogin({ reload: loadPageData });

  const {
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
  } = useMatchCheckInReview({
    match,
    registrations,
    currentUser,
    currentTeam,
    opponentTeam,
    isMatchApiDetail,
    isEndedMatch,
    submittingStatus,
    ensureCurrentLocation,
  });

  const {
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
  } = useMatchSettlement({
    match,
    registrations,
    usersById,
    canManageCurrentMatch,
    isEndedMatch,
    submittingStatus,
    confirmRegistrationAction,
  });

  const {
    handleSelectIndividualSignup,
    handleSignupSheetConfirm,
    handleSignupSheetCancelRegistration,
    handleSelectTeamMemberStand,
    handleTeamSubmit,
  } = useMatchRegistration({
    match,
    registrations,
    currentStatus,
    currentUser,
    currentTeam,
    submittingStatus,
    isGuestMode,
    isMatchApiDetail,
    registrationGroupId,
    canSubmitIndividualRegistration,
    registrationWindowState,
    canUseTeamRegistration,
    existingTeamDerivedActivity,
    sourceTeamRegistrationCount,
    teamRegistrationCount,
    ensureSessionReady,
    handleGuestLogin,
    confirmRegistrationAction,
    requiresPrepaidPayment,
    payRegistrationFee,
    isPickupMatch,
    myRegistrationPaid,
    openSignupSheet,
    closeSignupSheet,
  });

  const matchFinish = useMatchFinish({
    sourceMatch,
    currentTeam,
    currentUserId: computed(() => currentUser.value?.id),
    isGuestMode,
    submittingStatus,
    nowTick,
    reload: loadPageData,
  });

  async function loadPageData() {
    if (!matchId.value) return;

    isLoading.value = true;
    errorMessage.value = "";

    try {
      if (MATCH_API_ID_PATTERN.test(matchId.value)) {
        await ensureSessionReady();
      }
      const publicData = await loadPublicMatchDetailData(matchId.value, currentUser.value?.id, {
        preferredGroupId: preferredRegistrationGroupId.value,
        currentTeamId: currentTeam.value?.id,
      });
      const { activity, activityUsers } = publicData;

      match.value = activity;
      registrations.value = activityUsers;
      usersById.value = publicData.usersById;
      sourceTeamRegistrationCount.value = publicData.sourceTeamRegistrationCount;
      isMatchApiDetail.value = publicData.fromMatchApi;
      registrationGroupId.value = publicData.registrationGroupId;
      publicationModeLabel.value = publicData.publicationModeLabel;
      sourceMatch.value = publicData.sourceMatch;
      matchTeamGroups.value = publicData.teamGroups;
      selectedGroupMinPlayers.value = publicData.selectedGroupMinPlayers;
      existingTeamDerivedActivity.value = null;
      currentStatus.value = toStandLabel(toRegistrationStandCode(publicData.myRegistration?.status));
      applyMyRegistrationPaid(!!publicData.myRegistration?.paid);
      teamsById.value = {};
      currentTeamMembers.value = [];
      resetSettlementState();
      isGuestMode.value = hasManualLogout();

      if (isGuestMode.value) {
        registrationMode.value = "individual";
        return;
      }

      try {
        await ensureSessionReady();

        const context = await loadAuthenticatedMatchDetailContext({
          activity,
          activityUsers,
          activityPageItems: publicData.activityPageItems,
          myRegistration: publicData.myRegistration,
          currentTeamId: currentTeam.value?.id,
          currentUserId: currentUser.value?.id,
        });

        isGuestMode.value = false;
        existingTeamDerivedActivity.value = context.derivedActivity;
        teamRegistrationCount.value = clampTeamRegistrationCount(context.initialRegistrationCount);
        teamsById.value = context.teamsById;
        currentTeamMembers.value = context.currentTeamMembers;
        currentStatus.value = toStandLabel(context.currentUserStand);
        if (!canUseTeamRegistration.value) {
          registrationMode.value = "individual";
        }
        resetCheckInReviewState({
          enabled: context.checkInConfig?.enabled,
          radiusMeters: context.checkInConfig?.radius_meters,
          openMinutesBefore: context.checkInConfig?.open_minutes_before,
          closeMinutesAfter: context.checkInConfig?.close_minutes_after,
        });
        await loadSettlementSummaryIfAllowed();
      } catch (_sessionError) {
        isGuestMode.value = true;
        registrationMode.value = "individual";
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "比赛报名页加载失败";
    } finally {
      isLoading.value = false;
    }
  }

  function startCountdownTimer() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      nowTick.value = Date.now();
    }, 1000);
  }

  onLoad((options) => {
    matchId.value = options?.id ?? "";
    preferredRegistrationGroupId.value = options?.groupId ?? "";
    startCountdownTimer();
    uni.$on("session:login-completed", handleSessionLoginCompleted);
    void loadPageData();
  });

  onUnload(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    uni.$off("session:login-completed", handleSessionLoginCompleted);
  });

  return {
    matchId,
    loadPageData,
    pageStyle,
    contentStyle,
    errorMessage,
    isLoading,
    match,
    sourceMatch,
    currentStatus,
    teamProgressItems,
    registrationMode,
    canUseTeamRegistration,
    isRegistrationClosed,
    registrationWindowState,
    matchKindLabel,
    publicationModeLabel,
    homeTeamLabel,
    displayOpponentLabel,
    homeTeamColor,
    awayTeamColor,
    matchClockLabel,
    matchLocation,
    joinedCount,
    requiredPlayers,
    progressTargetPlayers,
    maxPlayers,
    countdownText,
    participantPreview,
    teamMemberRegistrationGroups,
    remainingPlayersLabel,
    registrationCapacityState,
    canSubmitIndividualRegistration,
    submittingStatus,
    pendingPaymentFeeLabel,
    submittingPayment,
    handlePayRegistration: payRegistrationFee,
    confirmRegistrationAction,
    confirmDialogVisible,
    confirmDialogState,
    handleConfirmPrimary,
    handleConfirmSecondary,
    handleConfirmClose,
    individualCtaLabel,
    isGuestMode,
    isPickupMatch,
    myRegistrationPaid,
    signupSheetVisible,
    signupMaxCount,
    myRegistrationCount,
    feePerPersonLabel,
    closeSignupSheet,
    handleSignupSheetConfirm,
    handleSignupSheetCancelRegistration,
    currentTeam,
    dateLine,
    heroMetaChips,
    opponentTeam,
    existingTeamDerivedActivity,
    teamFormTitle,
    teamSignupHint,
    teamRegistrationCount,
    teamRegistrationCountOptions,
    canShowCheckIn,
    hasCheckedIn,
    canManageCurrentMatch,
    checkInForm,
    canShowActivityReview,
    canSubmitActivityReview,
    reviewSubmitted,
    reviewForm,
    canShowSettlement,
    settlementSummary,
    settlementForm,
    settlementParticipants,
    settlementAttendeeCount,
    settlementSearchKeyword,
    settlementSearchResults,
    settlementSearching,
    teamSubmitLabel,
    openMatchLocation,
    handleSelectIndividualSignup,
    handleSelectTeamMemberStand,
    handleCheckIn,
    handleCheckInSwitchChange,
    handleSaveCheckInConfig,
    handleReviewRatingChange,
    handleSubmitActivityReview,
    handleSettlementModeChange,
    handleSettlementScopeChange,
    handleSettlementChargeAmountInput,
    handleRemoveSettlementCustomUser,
    handleSearchSettlementUsers,
    handleAddSettlementCustomUser,
    handleSubmitSettlement,
    handleTeamSubmit,
    ...matchFinish,
  };
}
