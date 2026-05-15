import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import {
  cancelIndividualRegistration,
  cancelTeamRegistrationForMatch,
  saveMatchCheckInConfig,
  submitIndividualLeave,
  submitIndividualRegistration,
  submitMatchActivityReview,
  submitMatchCheckIn,
  submitMatchSettlement,
  submitTeamRegistrationForMatch,
} from "./detailActions";
import { getActivitySettlement } from "@/api/billing";
import { searchUsers } from "@/api/user";
import { loadAuthenticatedMatchDetailContext, loadPublicMatchDetailData } from "./detailData";
import { useCurrentLocation } from "@/stores/currentLocation";
import { useTeamContext } from "@/stores/teamContext";
import { resumeSessionBootstrap } from "@/stores/appSession";
import { canShowTeamRegistrationTab } from "./registrationVisibility";
import { hasManualLogout } from "@/utils/authStorage";
import type {
  BackendActivity,
  BackendActivitySettlementSummary,
  BackendActivityCheckInRecord,
  BackendRegistration,
  BackendTeam,
  BackendTeamMember,
  BackendUser,
} from "@/types/backend";
import { getCustomNavMetrics } from "@/utils/customNav";
import { resolveUserDisplayName, toStandLabel } from "@/utils/viewModels";
import {
  applyCheckInPatch,
  applyIndividualRegistrationPatch,
  avatarColor,
  buildRegistrationProgress,
  buildRemainingPlayersLabel,
  clampTeamRegistrationCount,
  describeDaysUntil,
  formatClock,
  formatCountdown,
  formatMonthDay,
  formatWeekday,
  parseDateValue,
} from "./detailState";
import {
  buildRegisteredAttendeeCharges,
  buildSettlementParticipants,
  createDefaultSettlementForm,
  patchSettlementFormFromSummary,
  validateSettlementForm,
} from "./settlementState";

export function useMatchDetailPage() {
  const { currentTeam, currentUser, ensureSessionReady, refreshSessionContext } = useTeamContext();
  const { ensureCurrentLocation } = useCurrentLocation();

  const navMetrics = getCustomNavMetrics();
  const matchId = ref("");
  const isLoading = ref(false);
  const errorMessage = ref("");
  const submittingStatus = ref(false);
  const registrationMode = ref<"individual" | "team">("individual");
  const match = ref<BackendActivity | null>(null);
  const registrations = ref<BackendRegistration[]>([]);
  const usersById = ref<Record<number, BackendUser>>({});
  const teamsById = ref<Record<number, BackendTeam>>({});
  const currentTeamMembers = ref<BackendTeamMember[]>([]);
  const relatedActivities = ref<BackendActivity[]>([]);
  const sourceTeamRegistrationCount = ref(0);
  const existingTeamDerivedActivity = ref<BackendActivity | null>(null);
  const currentStatus = ref("待定");
  const nowTick = ref(Date.now());
  const teamRegistrationCount = ref(5);
  const checkInForm = ref({
    enabled: false,
    radiusMeters: 200,
    openMinutesBefore: 60,
    closeMinutesAfter: 45,
  });
  const reviewForm = ref({
    rating: 5,
    comment: "",
  });
  const settlementSummary = ref<BackendActivitySettlementSummary | null>(null);
  const settlementForm = ref(createDefaultSettlementForm());
  const settlementSearchKeyword = ref("");
  const settlementSearchResults = ref<BackendUser[]>([]);
  const settlementSearching = ref(false);
  const reviewSubmitted = ref(false);
  const isGuestMode = ref(false);
  const isGuestLoginSubmitting = ref(false);

  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  const pageStyle = computed(() => ({
    paddingBottom: registrationMode.value === "team" && canUseTeamRegistration.value ? "188rpx" : "96rpx",
  }));

  const contentStyle = computed(() => ({
    paddingTop: `${navMetrics.pageTopPadding + 8}px`,
  }));

  const joinedRegistrations = computed(() => registrations.value.filter((item) => item.stand === 1 || item.stand === 3));
  const joinedCount = computed(() => joinedRegistrations.value.length + sourceTeamRegistrationCount.value);
  const requiredPlayers = computed(() => match.value?.players_per_team ?? 0);
  const maxPlayers = computed(() => (requiredPlayers.value > 0 ? requiredPlayers.value + 2 : 0));
  const isAtRegistrationCapacity = computed(() => maxPlayers.value > 0 && joinedCount.value >= maxPlayers.value);
  const registrationProgress = computed(() => buildRegistrationProgress(joinedCount.value, requiredPlayers.value, maxPlayers.value));
  const progressBaseWidth = computed(() => registrationProgress.value.baseWidth);
  const progressExtraWidth = computed(() => registrationProgress.value.extraWidth);
  const progressSplitLeft = computed(() => registrationProgress.value.splitLeft);

  const remainingPlayersLabel = computed(() => buildRemainingPlayersLabel(joinedCount.value, requiredPlayers.value));

  const dateLine = computed(() => {
    if (!match.value) return "";
    return `${formatMonthDay(match.value.holding_date)} ${formatWeekday(match.value.holding_date)} ${formatClock(match.value.start_time)}`;
  });
  const matchDateLabel = computed(() => (match.value ? `${formatMonthDay(match.value.holding_date)} ${formatWeekday(match.value.holding_date)}` : ""));
  const matchClockLabel = computed(() => (match.value ? formatClock(match.value.start_time) : ""));

  const matchStartTimestamp = computed(() => {
    if (!match.value) return 0;
    return parseDateValue(match.value.start_time || match.value.holding_date).getTime();
  });

  const countdownText = computed(() => formatCountdown(matchStartTimestamp.value - nowTick.value));

  const heroMetaChips = computed(() => {
    if (!match.value) return [];
    return [
      requiredPlayers.value ? `${requiredPlayers.value}人制` : "人数待定",
      describeDaysUntil(matchStartTimestamp.value, nowTick.value),
      "免费报名",
    ];
  });

  const participantPreview = computed(() =>
    joinedRegistrations.value.slice(0, 5).map((item) => {
      const user = usersById.value[item.user_id];
      return {
        id: item.user_id,
        name: resolveUserDisplayName(user),
        avatarUrl: user?.avatar_url ?? "",
        tone: avatarColor(item.user_id),
      };
    }),
  );
  const registrationByUserId = computed(() => Object.fromEntries(registrations.value.map((item) => [item.user_id, item])));
  const activeTeamMembers = computed(() => currentTeamMembers.value.filter((member) => member.status === 1));
  const teamMemberRegistrationGroups = computed(() => {
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
      joined: activeTeamMembers.value.filter((member) => registrationByUserId.value[member.user_id]?.stand === 1).map(toCard),
      leave: activeTeamMembers.value.filter((member) => registrationByUserId.value[member.user_id]?.stand === 2).map(toCard),
      pending: activeTeamMembers.value.filter((member) => {
        const stand = registrationByUserId.value[member.user_id]?.stand ?? 0;
        return stand !== 1 && stand !== 2;
      }).map(toCard),
    };
  });

  const matchKindLabel = computed(() => (match.value?.match_kind === "internal" ? "队内内战" : "对外友谊赛"));
  const homeTeamLabel = computed(() => currentTeam.value?.name || "主队");
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

  const interestCards = computed(() =>
    relatedActivities.value.slice(0, 2).map((item) => ({
      id: item.id,
      title: item.name,
      dateLine: `${formatMonthDay(item.holding_date)} ${formatClock(item.start_time)}`,
      venue: item.location,
    })),
  );

  const individualCtaLabel = computed(() => {
    if (isGuestMode.value) return "登录后报名";
    return currentStatus.value === "参加" ? "取消报名" : "立即报名";
  });
  const canUseTeamRegistration = computed(() =>
    canShowTeamRegistrationTab({
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
  const canShowCheckIn = computed(() => !isDerivedTeamSignupActivity.value && !!currentTeamCheckInConfig.value?.enabled && !!currentTeam.value);
  const canManageCurrentMatch = computed(() => !isDerivedTeamSignupActivity.value && !!currentTeam.value?.canManageTeam);
  const isEndedMatch = computed(() => match.value?.status === 2 || (matchStartTimestamp.value > 0 && nowTick.value > matchStartTimestamp.value));
  const canSubmitActivityReview = computed(
    () => !!currentTeam.value && !!opponentTeam.value && isEndedMatch.value && canManageCurrentMatch.value && !reviewSubmitted.value,
  );
  const canShowActivityReview = computed(
    () => !!currentTeam.value && !!opponentTeam.value && isEndedMatch.value && canManageCurrentMatch.value,
  );
  const canShowSettlement = computed(() => isEndedMatch.value && canManageCurrentMatch.value);
  const settlementAttendeeCount = computed(() => registrations.value.filter((item) => item.stand === 1).length);
  const settlementParticipants = computed(() =>
    buildSettlementParticipants({
      charges: settlementForm.value.charges,
      usersById: usersById.value,
      summary: settlementSummary.value,
    }),
  );

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

  async function loadPageData() {
    if (!matchId.value) return;

    isLoading.value = true;
    errorMessage.value = "";

    try {
      const publicData = await loadPublicMatchDetailData(matchId.value);
      const { activity, activityUsers } = publicData;

      match.value = activity;
      registrations.value = activityUsers;
      usersById.value = publicData.usersById;
      relatedActivities.value = publicData.relatedActivities;
      sourceTeamRegistrationCount.value = publicData.sourceTeamRegistrationCount;
      existingTeamDerivedActivity.value = null;
      currentStatus.value = "待定";
      teamsById.value = {};
      currentTeamMembers.value = [];
      settlementSummary.value = null;
      settlementForm.value = createDefaultSettlementForm();
      settlementSearchKeyword.value = "";
      settlementSearchResults.value = [];
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
        checkInForm.value = {
          enabled: context.checkInConfig?.enabled ?? false,
          radiusMeters: context.checkInConfig?.radius_meters ?? 200,
          openMinutesBefore: context.checkInConfig?.open_minutes_before ?? 60,
          closeMinutesAfter: context.checkInConfig?.close_minutes_after ?? 45,
        };
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

  function syncRegisteredSettlementCharges() {
    if (settlementForm.value.participantScope !== "registered_attendees") return;
    settlementForm.value.charges = buildRegisteredAttendeeCharges(
      registrations.value,
      usersById.value,
      settlementForm.value.charges,
    );
  }

  function handleCheckInSwitchChange(event: Event) {
    const detail = event as Event & { detail?: { value?: boolean } };
    checkInForm.value = {
      ...checkInForm.value,
      enabled: !!detail.detail?.value,
    };
  }

  function handleReviewRatingChange(event: Event) {
    const detail = event as Event & { detail?: { value?: number | string } };
    reviewForm.value = {
      ...reviewForm.value,
      rating: Number(detail.detail?.value ?? 0) + 1,
    };
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

    usersById.value = {
      ...usersById.value,
      [user.id]: user,
    };
    settlementForm.value.charges = [...settlementForm.value.charges, { userId: user.id, amount: "" }];
  }

  function applyIndividualRegistrationState(stand: number, registrationCount: number) {
    const userId = currentUser.value?.id;
    if (!userId) return;

    currentStatus.value = toStandLabel(stand);
    registrations.value = applyIndividualRegistrationPatch(registrations.value, userId, stand, registrationCount);
  }

  function applyCheckInState(record: BackendActivityCheckInRecord) {
    registrations.value = applyCheckInPatch(registrations.value, record);
  }

  function applyCheckInConfigState(nextMatch: BackendActivity) {
    match.value = nextMatch;
  }

  function applyActivityReviewState() {
    reviewSubmitted.value = true;
  }

  function confirmRegistrationAction(options: { title: string; content: string; confirmText?: string }) {
    return new Promise<boolean>((resolve) => {
      uni.showModal({
        title: options.title,
        content: options.content,
        confirmText: options.confirmText ?? "确认",
        cancelText: "再想想",
        success: (result) => {
          resolve(!!result.confirm);
        },
        fail: () => resolve(false),
      });
    });
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
    uni.showLoading({
      title: "登录中...",
      mask: true,
    });

    try {
      await refreshSessionContext();
      uni.$emit("session:login-completed", { fromRoute });
      if (!currentUser.value || !currentTeam.value) {
        uni.switchTab({ url: "/pages/user/index" });
        return;
      }

      await loadPageData();
    } catch (error) {
      uni.switchTab({ url: "/pages/user/index" });
    } finally {
      uni.hideLoading();
      isGuestLoginSubmitting.value = false;
    }
  }

  async function handleSelectIndividualSignup() {
    if (!match.value || submittingStatus.value) return;
    if (isGuestMode.value) {
      await handleGuestLogin();
      return;
    }
    if (currentStatus.value === "参加") {
      await handleCancelIndividualSignup();
      return;
    }
    if (isAtRegistrationCapacity.value) {
      uni.showToast({
        title: "本场已满员",
        icon: "none",
      });
      return;
    }

    const confirmed = await confirmRegistrationAction({
      title: "确认报名",
      content: `确认报名参加「${match.value.name}」？`,
      confirmText: "确认报名",
    });
    if (!confirmed) return;

    submittingStatus.value = true;
    try {
      await ensureSessionReady();
      await submitIndividualRegistration(match.value.id);
      applyIndividualRegistrationState(1, 1);
      uni.showToast({
        title: "报名成功",
        icon: "none",
      });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "报名失败",
        icon: "none",
      });
    } finally {
      submittingStatus.value = false;
    }
  }

  async function handleCancelIndividualSignup() {
    if (!match.value || submittingStatus.value) return;

    const confirmed = await confirmRegistrationAction({
      title: "确认取消报名",
      content: `确认取消「${match.value.name}」的报名？取消后可重新报名。`,
      confirmText: "取消报名",
    });
    if (!confirmed) return;

    submittingStatus.value = true;
    try {
      await ensureSessionReady();
      await cancelIndividualRegistration(match.value.id);
      applyIndividualRegistrationState(0, 0);
      uni.showToast({
        title: "已取消报名",
        icon: "none",
      });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "取消报名失败",
        icon: "none",
      });
    } finally {
      submittingStatus.value = false;
    }
  }

  async function handleSelectTeamMemberStand(stand: 0 | 1 | 2) {
    if (!match.value || submittingStatus.value) return;
    if (isGuestMode.value) {
      await handleGuestLogin();
      return;
    }

    const nextLabel = stand === 1 ? "报名" : stand === 2 ? "请假" : "设为未报名";
    const confirmed = await confirmRegistrationAction({
      title: `确认${nextLabel}`,
      content: stand === 0 ? `确认将「${match.value.name}」状态改为未报名？` : `确认${nextLabel}参加「${match.value.name}」？`,
      confirmText: nextLabel,
    });
    if (!confirmed) return;

    submittingStatus.value = true;
    try {
      await ensureSessionReady();
      if (stand === 1) {
        await submitIndividualRegistration(match.value.id);
        applyIndividualRegistrationState(1, 1);
      } else if (stand === 2) {
        await submitIndividualLeave(match.value.id);
        applyIndividualRegistrationState(2, 0);
      } else {
        await cancelIndividualRegistration(match.value.id);
        applyIndividualRegistrationState(0, 0);
      }
      uni.showToast({
        title: stand === 1 ? "报名成功" : stand === 2 ? "已请假" : "已设为未报名",
        icon: "none",
      });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : `${nextLabel}失败`,
        icon: "none",
      });
    } finally {
      submittingStatus.value = false;
    }
  }

  async function handleTeamSubmit() {
    if (!match.value || submittingStatus.value) return;
    if (!canUseTeamRegistration.value || !currentTeam.value) {
      uni.showToast({
        title: "仅队长或领队可发起球队报名",
        icon: "none",
        duration: 2800,
      });
      return;
    }

    const registrationCount = clampTeamRegistrationCount(Number(teamRegistrationCount.value));
    teamRegistrationCount.value = registrationCount;

    submittingStatus.value = true;
    try {
      if (existingTeamDerivedActivity.value) {
        const confirmed = await confirmRegistrationAction({
          title: "取消球队报名",
          content: "确认取消当前球队报名？对应的队内报名也会关闭。",
          confirmText: "取消报名",
        });
        if (!confirmed) return;

        await cancelTeamRegistrationForMatch(match.value.id, currentTeam.value.id);
        sourceTeamRegistrationCount.value = Math.max(
          sourceTeamRegistrationCount.value - Number(existingTeamDerivedActivity.value.team_registration_count ?? 0),
          0,
        );
        existingTeamDerivedActivity.value = null;
        uni.showToast({
          title: "球队报名已取消",
          icon: "none",
        });
        return;
      }

      const derivedActivity = await submitTeamRegistrationForMatch(match.value.id, currentTeam.value.id, registrationCount);
      existingTeamDerivedActivity.value = derivedActivity;
      uni.showToast({
        title: "球队报名已发起",
        icon: "none",
      });
      if (derivedActivity.id && derivedActivity.id !== match.value.id) {
        setTimeout(() => {
          uni.redirectTo({ url: `/pages/matches/detail?id=${derivedActivity.id}` });
        }, 500);
      }
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "球队报名失败",
        icon: "none",
      });
    } finally {
      submittingStatus.value = false;
    }
  }

  async function handleCheckIn() {
    if (!match.value || !currentTeam.value || submittingStatus.value) return;
    if (!canShowCheckIn.value) {
      uni.showToast({
        title: "当前比赛未开启签到",
        icon: "none",
      });
      return;
    }
    if (hasCheckedIn.value) {
      uni.showToast({
        title: "你已经签到过了",
        icon: "none",
      });
      return;
    }

    submittingStatus.value = true;
    try {
      const location = await ensureCurrentLocation();
      if (!location) {
        throw new Error("未获取到当前位置");
      }
      const record = await submitMatchCheckIn({
        activityId: match.value.id,
        teamId: currentTeam.value.id,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      applyCheckInState(record);
      uni.showToast({
        title: "签到成功",
        icon: "none",
      });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "签到失败",
        icon: "none",
      });
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
      const nextMatch = await saveMatchCheckInConfig({
        activityId: match.value.id,
        teamId: currentTeam.value.id,
        enabled: checkInForm.value.enabled,
        radiusMeters: Number(checkInForm.value.radiusMeters),
        openMinutesBefore: Number(checkInForm.value.openMinutesBefore),
        closeMinutesAfter: Number(checkInForm.value.closeMinutesAfter),
      });
      applyCheckInConfigState(nextMatch);
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
      applyActivityReviewState();
      uni.showToast({ title: "赛后互评已提交", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "互评提交失败", icon: "none" });
    } finally {
      submittingStatus.value = false;
    }
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

  function openMatchDetail(matchId: string) {
    uni.navigateTo({
      url: `/pages/matches/detail?id=${matchId}`,
    });
  }

  function startCountdownTimer() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      nowTick.value = Date.now();
    }, 1000);
  }

  onLoad((options) => {
    matchId.value = options?.id ?? "";
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
    pageStyle,
    contentStyle,
    errorMessage,
    isLoading,
    match,
    registrationMode,
    canUseTeamRegistration,
    matchKindLabel,
    homeTeamLabel,
    displayOpponentLabel,
    homeTeamColor,
    awayTeamColor,
    matchDateLabel,
    matchClockLabel,
    matchLocation,
    joinedCount,
    requiredPlayers,
    countdownText,
    progressBaseWidth,
    progressExtraWidth,
    progressSplitLeft,
    participantPreview,
    teamMemberRegistrationGroups,
    remainingPlayersLabel,
    submittingStatus,
    individualCtaLabel,
    isGuestMode,
    currentTeam,
    interestCards,
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
    openMatchDetail,
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
  };
}
