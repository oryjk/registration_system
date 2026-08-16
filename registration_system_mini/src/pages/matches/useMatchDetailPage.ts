import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { MATCH_API_ID_PATTERN, loadAuthenticatedMatchDetailContext, loadPublicMatchDetailData, toRegistrationStandCode, type MatchTeamGroupSummary } from "./detailData";
import { useCurrentLocation } from "@/stores/currentLocation";
import { useTeamContext } from "@/stores/teamContext";
import { resumeSessionBootstrap } from "@/stores/appSession";
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
  byUserIdAsc,
  buildRemainingPlayersLabel,
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
import { useMatchCheckInReview } from "./useMatchCheckInReview";
import { useMatchSettlement } from "./useMatchSettlement";
import { useMatchFinish } from "./useMatchFinish";
import { useNeoConfirmDialog } from "@/components/neo";
import type { NeoConfirmDialogOptions } from "@/components/neo";

export function useMatchDetailPage() {
  const { currentTeam, currentUser, ensureSessionReady, refreshSessionContext } = useTeamContext();
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
  const isGuestLoginSubmitting = ref(false);
  const isMatchApiDetail = ref(false);
  const registrationGroupId = ref("");
  const preferredRegistrationGroupId = ref("");
  const publicationModeLabel = ref("其他类型");

  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  // 底部留白复用全局 token：悬浮操作栏占位 + 与内容间距，兼容全面屏安全区。
  const pageStyle = computed(() => ({
    paddingBottom: "var(--neo-action-bar-clearance)",
  }));

  const contentStyle = computed(() => ({
    paddingTop: `${navMetrics.pageTopPadding + 8}px`,
  }));

  const joinedRegistrations = computed(() => registrations.value.filter((item) => item.stand === 1));
  const joinedCount = computed(() => joinedRegistrations.value.length + sourceTeamRegistrationCount.value);
  const requiredPlayers = computed(() => match.value?.players_per_team ?? 0);
  const maxPlayers = computed(() => {
    const configuredCapacity = match.value?.team_capacity_limit;
    if (!Number.isFinite(configuredCapacity) || (configuredCapacity ?? 0) <= 0) {
      return requiredPlayers.value;
    }
    return Math.max(configuredCapacity ?? requiredPlayers.value, requiredPlayers.value);
  });

  const remainingPlayersLabel = computed(() => buildRemainingPlayersLabel(joinedCount.value, requiredPlayers.value));
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
      return {
        id: item.user_id,
        name: resolveUserDisplayName(user),
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
  const teamMemberRegistrationGroups = computed(() => {
    const byMemberRegistrationTimeAsc = (left: BackendTeamMember, right: BackendTeamMember) =>
      byRegistrationTimeAsc(
        {
          user_id: left.user_id,
          operation_time: registrationByUserId.value[left.user_id]?.operation_time,
        },
        {
          user_id: right.user_id,
          operation_time: registrationByUserId.value[right.user_id]?.operation_time,
        },
      );
    const toCard = (member: BackendTeamMember) => {
      const user = usersById.value[member.user_id];
      return {
        userId: member.user_id,
        name: resolveUserDisplayName(user),
        avatarUrl: user?.avatar_url ?? "",
        tone: avatarColor(member.user_id),
        jerseyNumber: member.jersey_number ?? "",
        isCurrentUser: member.user_id === currentUser.value?.id,
      };
    };

    return {
      joined: activeTeamMembers.value.filter((member) => registrationByUserId.value[member.user_id]?.stand === 1).sort(byMemberRegistrationTimeAsc).map(toCard),
      leave: activeTeamMembers.value.filter((member) => registrationByUserId.value[member.user_id]?.stand === 2).sort(byMemberRegistrationTimeAsc).map(toCard),
      pending: activeTeamMembers.value.filter((member) => {
        const stand = registrationByUserId.value[member.user_id]?.stand ?? 0;
        return stand !== 1 && stand !== 2;
      }).sort(byUserIdAsc).map(toCard),
    };
  });

  const matchKindLabel = computed(() => publicationModeLabel.value);
  // 主队是发起约队的球队：新接口取 host_team_name；legacy 队内活动没有该字段，用当前球队兜底。
  const homeTeamLabel = computed(() => sourceMatch.value?.host_team_name || currentTeam.value?.name || "主队");
  const displayOpponentLabel = computed(() => match.value?.opposing || opponentTeam.value?.name || "对手待定");
  const homeTeamColor = computed(() => match.value?.color?.trim() || "#2f6bff");
  const awayTeamColor = computed(() => match.value?.opposing_color?.trim() || "#d9ff16");
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
    if (registrationCapacityState.value.isFull) return "报名已满";
    return currentStatus.value === "参加" ? "取消报名" : "立即报名";
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

  function getCurrentPageRoute() {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    return currentPage?.route ? `/${currentPage.route}` : "";
  }

  async function handleGuestLogin() {
    if (isGuestLoginSubmitting.value) return;

    isGuestLoginSubmitting.value = true;
    const fromRoute = getCurrentPageRoute();
    resumeSessionBootstrap();
    uni.showLoading({ title: "登录中...", mask: true });
    try {
      await refreshSessionContext();
      uni.$emit("session:login-completed", { fromRoute });
      if (!currentUser.value || !currentTeam.value) {
        uni.switchTab({ url: "/pages/user/index" });
        return;
      }
      await loadPageData();
    } catch (_error) {
      uni.switchTab({ url: "/pages/user/index" });
    } finally {
      uni.hideLoading();
      isGuestLoginSubmitting.value = false;
    }
  }

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
  });

  const {
    canFinishMatch,
    finishDialogVisible,
    handleOpenFinishDialog,
    handleCloseFinishDialog,
    handleFinishMatch,
  } = useMatchFinish({
    sourceMatch,
    currentTeam,
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
      existingTeamDerivedActivity.value = null;
      currentStatus.value = toStandLabel(toRegistrationStandCode(publicData.myRegistration?.status));
      teamsById.value = {};
      currentTeamMembers.value = [];
      resetSettlementState();
      isGuestMode.value = hasManualLogout();

      if (isGuestMode.value) {
        registrationMode.value = "individual";
        return;
      }

      if (isMatchApiDetail.value) {
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
    void loadPageData();
  });

  onUnload(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
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
    maxPlayers,
    countdownText,
    participantPreview,
    teamMemberRegistrationGroups,
    remainingPlayersLabel,
    registrationCapacityState,
    canSubmitIndividualRegistration,
    submittingStatus,
    confirmDialogVisible,
    confirmDialogState,
    handleConfirmPrimary,
    handleConfirmSecondary,
    handleConfirmClose,
    individualCtaLabel,
    isGuestMode,
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
    canFinishMatch,
    finishDialogVisible,
    handleOpenFinishDialog,
    handleCloseFinishDialog,
    handleFinishMatch,
  };
}
