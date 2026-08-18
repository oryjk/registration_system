import { computed, ref } from "vue";
import { getWallet } from "@/api/wallet";
import { updateMyProfile } from "@/api/user";
import type { BackendTeamCreditTransaction } from "@/types/backend";
import type { MineMatchSummary, MineStatItem } from "./mineTypes";
import { buildMineOverviewState } from "./mineOverviewState";
import { loadAllMyMatches } from "./myMatchesData";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { clearSession } from "@/stores/appSession";
import { loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import {
  formatCreditTransactionLabel,
  formatDateTimeLabel,
  resolveUserDisplayName,
} from "@/utils/viewModels";

export function useMinePage() {
  const {
    availableIdentities,
    currentIdentity,
    currentTeam,
    currentUser,
    teamProfiles,
    switchIdentity,
    switchTeam,
    ensureSessionReady,
    ensureTeamDetailLoaded,
    refreshSessionContext,
  } = useTeamContext();
  const { shouldHideCreationEntrances } = useMiniReviewStatus();
  const { unreadCount, setUnreadCount } = useNotificationCenter();
  const navMetrics = getCustomNavMetrics();

  const isLoading = ref(false);
  const isSwitchingTeam = ref(false);
  const isPayingMembership = ref(false);
  const hasLoadedOnce = ref(false);
  const errorMessage = ref("");
  const myMatches = ref<MineMatchSummary[]>([]);
  const creditTransactions = ref<BackendTeamCreditTransaction[]>([]);
  const debugClearProfileEnabled = ref(false);
  const overviewDigest = ref({
    activityCount: 0,
    teamCount: 0,
    totalHoursLabel: "0h",
  });
  const walletSummary = ref({
    balanceLabel: "¥0.00",
    totalExpenseLabel: "¥0.00",
    latestExpenseLabel: "暂无支出",
  });

  const displayName = computed(() => resolveUserDisplayName(currentUser.value));
  const showInitialLoadingState = computed(() => isLoading.value && !hasLoadedOnce.value);
  const visibleErrorMessage = computed(() => currentUser.value ? errorMessage.value : "");
  const messageSummary = computed(() =>
    unreadCount.value > 0 ? `约队发布、约成、取消等消息共 ${unreadCount.value} 条未读` : "约队发布、约成、取消等消息会先站内通知",
  );
  const latestCreditRecord = computed(() => creditTransactions.value[0] ?? null);
  const contentStyle = computed(() => ({
    paddingTop: `${navMetrics.pageTopPadding + 8}px`,
  }));
  const creditCardSummary = computed(() =>
    latestCreditRecord.value
      ? `${formatCreditTransactionLabel(latestCreditRecord.value)} · ${formatDateTimeLabel(latestCreditRecord.value.created_at)}`
      : "全员队员信用会在这里展示",
  );
  const currentTeamJoinedDaysLabel = computed(() => {
    const joinedAt = currentTeam.value?.joinedAt;
    if (!joinedAt) return "";

    const joinedTime = parseDateTime(joinedAt);
    if (!Number.isFinite(joinedTime)) return "";

    const todayStart = todayStartTimestamp();
    const joinedStart = new Date(joinedTime);
    joinedStart.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.floor((todayStart - joinedStart.getTime()) / 86_400_000) + 1);
    return `${days} 天`;
  });
  const mineStats = computed<MineStatItem[]>(() => [
    {
      key: "matches",
      label: "今年比赛",
      value: String(overviewDigest.value.activityCount),
      unit: "次",
      tone: "lime",
    },
    {
      key: "teams",
      label: "加入球队",
      value: String(overviewDigest.value.teamCount),
      unit: "支",
      tone: "blue",
    },
    {
      key: "hours",
      label: "今年时长",
      value: overviewDigest.value.totalHoursLabel,
      tone: "amber",
    },
    {
      key: "joinedDays",
      label: "加入当前球队",
      value: currentTeamJoinedDaysLabel.value || "0 天",
      tone: "coral",
    },
  ]);

  function parseDateTime(value: string) {
    return new Date(value.replace(" ", "T")).getTime();
  }

  function todayStartTimestamp() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  function resetPageState(message = "已退出登录，请点击顶部卡片重新登录") {
    hasLoadedOnce.value = false;
    isSwitchingTeam.value = false;
    errorMessage.value = message;
    myMatches.value = [];
    creditTransactions.value = [];
    debugClearProfileEnabled.value = false;
    overviewDigest.value = {
      activityCount: 0,
      teamCount: 0,
      totalHoursLabel: "0h",
    };
    walletSummary.value = {
      balanceLabel: "¥0.00",
      totalExpenseLabel: "¥0.00",
      latestExpenseLabel: "暂无支出",
    };
    setUnreadCount(0);
  }

  async function loadPageData(options?: { preserveContent?: boolean }) {
    const preserveContent = !!options?.preserveContent && hasLoadedOnce.value;

    if (preserveContent) {
      isSwitchingTeam.value = true;
    } else {
      isLoading.value = true;
    }
    errorMessage.value = "";

    try {
      if (hasManualLogout()) {
        resetPageState("登录后可以查看你的比赛、出勤、钱包和球队数据");
        hasLoadedOnce.value = true;
        return;
      }

      await ensureSessionReady();
      const activeTeamId = currentTeam.value?.id;
      if (activeTeamId) {
        await ensureTeamDetailLoaded(activeTeamId);
      }
      const [matches, wallet, runtimeConfig] = await Promise.all([
        loadAllMyMatches(),
        getWallet(),
        loadMiniAppRuntimeConfig(),
      ]);
      const overview = buildMineOverviewState(matches, wallet);

      myMatches.value = overview.matches;
      debugClearProfileEnabled.value = runtimeConfig.debug.clear_profile_enabled;
      overviewDigest.value = {
        activityCount: overview.activityCount,
        teamCount: teamProfiles.value.length,
        totalHoursLabel: overview.totalHoursLabel,
      };
      creditTransactions.value = [];
      walletSummary.value = overview.walletSummary;
      setUnreadCount(0);
      hasLoadedOnce.value = true;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "个人中心数据加载失败";
    } finally {
      if (preserveContent) {
        isSwitchingTeam.value = false;
      } else {
        isLoading.value = false;
      }
    }
  }

  function handleSwitchTeam(teamId: number) {
    if (!teamId || currentTeam.value?.id === teamId || isSwitchingTeam.value) return;
    switchTeam(teamId);
    void loadPageData({ preserveContent: true });
  }

  function handleSwitchIdentity(identityId: string) {
    if (!identityId || currentIdentity.value?.id === identityId) return;
    switchIdentity(identityId);
  }

  function handleEditProfile() {
    uni.navigateTo({ url: "/pages/profile/setup/index?mode=edit" });
  }

  function handleCompleteProfile() {
    uni.navigateTo({ url: "/pages/profile/setup/index" });
  }

  async function handleDebugClearProfile() {
    if (!currentUser.value) return;
    const confirmed = await confirmDialog({
      title: "清除头像和昵称",
      content: "验证用入口：清除后头像和昵称会被清空，回到未完善资料状态。",
    });
    if (!confirmed) return;
    try {
      await updateMyProfile({ nickname: "", avatar_url: "" });
      await refreshSessionContext();
      uni.showToast({ title: "已清除，完善提示应重新出现", icon: "none" });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "清除失败",
        icon: "none",
      });
    }
  }

  function openTeamDetail(teamId?: number) {
    const targetId = teamId ?? currentTeam.value?.id;
    if (!targetId) return;
    uni.navigateTo({ url: `/pages/teams/detail/index?teamId=${targetId}` });
  }

  function openTeamManage(teamId?: number) {
    return openTeamDetail(teamId);
  }

  function openNotifications() {
    uni.navigateTo({ url: "/pages/notifications/index" });
  }

  function openUserMatches() {
    uni.navigateTo({ url: "/pages/user/matches/index" });
  }

  function openMatchDetail(matchId: string) {
    uni.navigateTo({ url: `/pages/matches/detail?id=${matchId}` });
  }

  function openBilling() {
    uni.navigateTo({ url: "/pages/billing/index" });
  }

  function confirmDialog(options: { title: string; content: string }): Promise<boolean> {
    return new Promise((resolve) => {
      uni.showModal({
        title: options.title,
        content: options.content,
        confirmText: "确认",
        cancelText: "取消",
        success: (result) => resolve(!!result.confirm),
        fail: () => resolve(false),
      });
    });
  }

  async function handleLogin() {
    if (currentUser.value) return;
    uni.showLoading({ title: "登录中...", mask: true });
    try {
      await refreshSessionContext();
      await loadPageData();
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "登录失败", icon: "none" });
    } finally {
      uni.hideLoading();
    }
  }

  async function handleLogout() {
    if (!currentUser.value) {
      resetPageState();
      return;
    }
    const confirmed = await confirmDialog({
      title: "退出登录",
      content: "退出后会清空本地会话，需要你手动再次点击顶部卡片重新登录。",
    });
    if (!confirmed) return;
    clearSession();
    resetPageState();
    uni.showToast({ title: "已退出登录", icon: "none" });
  }

  function handleMembershipRenewal() {
    openTeamDetail();
  }

  return {
    availableIdentities,
    currentIdentity,
    currentTeam,
    currentUser,
    teamProfiles,
    shouldHideCreationEntrances,
    isLoading,
    isSwitchingTeam,
    isPayingMembership,
    myMatches,
    displayName,
    showInitialLoadingState,
    visibleErrorMessage,
    messageSummary,
    contentStyle,
    creditCardSummary,
    currentTeamJoinedDaysLabel,
    mineStats,
    walletSummary,
    debugClearProfileEnabled,
    loadPageData,
    handleEditProfile,
    handleCompleteProfile,
    handleDebugClearProfile,
    handleLogin,
    handleLogout,
    handleSwitchTeam,
    handleSwitchIdentity,
    openTeamManage,
    openNotifications,
    openUserMatches,
    openMatchDetail,
    openBilling,
    handleMembershipRenewal,
  };
}
