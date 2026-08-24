import { computed, ref } from "vue";
import { getWallet } from "@/api/wallet";
import type { MineMatchSummary, MineStatItem } from "./mineTypes";
import { buildMineOverviewState } from "./mineOverviewState";
import { loadAllMyMatches } from "./myMatchesData";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { useTeamContext } from "@/stores/teamContext";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { clearSession, resetLocalSession } from "@/stores/appSession";
import { useNeoConfirmDialog } from "@/components/neo";
import { PRODUCT_OWNER_USER_ID } from "@/config/productOwner";
import { hasManualLogout } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import {
  formatDateTimeLabel,
  resolveUserDisplayName,
} from "@/utils/viewModels";

export function useMinePage() {
  const {
    currentTeam,
    currentUser,
    teamProfiles,
    switchTeam,
    ensureSessionReady,
    ensureTeamDetailLoaded,
    refreshSessionContext,
  } = useTeamContext();
  const { shouldHideCreationEntrances } = useMiniReviewStatus();
  const { setUnreadCount } = useNotificationCenter();
  const {
    confirmDialogVisible,
    confirmDialogState,
    confirm,
    handleConfirmPrimary,
    handleConfirmSecondary,
    handleConfirmClose,
  } = useNeoConfirmDialog();
  const navMetrics = getCustomNavMetrics();

  const isLoading = ref(false);
  const isSwitchingTeam = ref(false);
  const hasLoadedOnce = ref(false);
  const errorMessage = ref("");
  const myMatches = ref<MineMatchSummary[]>([]);
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
  // 「设置」入口只对产品负责人账号显示，页内为运营/验证工具集合。
  const settingsEntryVisible = computed(() => currentUser.value?.id === PRODUCT_OWNER_USER_ID);
  const showInitialLoadingState = computed(() => isLoading.value && !hasLoadedOnce.value);
  const visibleErrorMessage = computed(() => currentUser.value ? errorMessage.value : "");
  const contentStyle = computed(() => ({
    paddingTop: `${navMetrics.pageTopPadding + 8}px`,
  }));
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
      const [matches, wallet] = await Promise.all([
        loadAllMyMatches(),
        getWallet(),
      ]);
      const overview = buildMineOverviewState(matches, wallet);

      myMatches.value = overview.matches;
      overviewDigest.value = {
        activityCount: overview.activityCount,
        teamCount: teamProfiles.value.length,
        totalHoursLabel: overview.totalHoursLabel,
      };
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

  function handleEditProfile() {
    uni.navigateTo({ url: "/pages/profile/setup/index?mode=edit" });
  }

  function handleCompleteProfile() {
    uni.navigateTo({ url: "/pages/profile/setup/index" });
  }

  function openSettings() {
    uni.navigateTo({ url: "/pages/user/settings/index" });
  }

  function openTeamDetail(teamId?: number) {
    const targetId = teamId ?? currentTeam.value?.id;
    if (!targetId) return;
    uni.navigateTo({ url: `/pages/teams/detail/index?teamId=${targetId}` });
  }

  function openTeamManage(teamId?: number) {
    return openTeamDetail(teamId);
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

  function confirmDialog(options: { title: string; content: string; confirmText?: string; danger?: boolean }): Promise<boolean> {
    return confirm(options);
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
    });    if (!confirmed) return;
    clearSession();
    resetPageState();
    uni.showToast({ title: "已退出登录", icon: "none" });
  }

  // 清空本机数据兜底：清掉登录态与本地偏好后原地静默重建会话（微信登录无感）。
  async function handleClearLocalData() {
    const confirmed = await confirmDialog({
      title: "清空本机数据",
      content: "将清除登录态与本地偏好（当前球队、身份选择），随后自动重新登录。遇到页面异常、数据错乱等疑难问题时使用。",
      confirmText: "清空并重登",
      danger: true,
    });
    if (!confirmed) return;

    uni.showLoading({ title: "重置中...", mask: true });
    try {
      resetLocalSession();
      await refreshSessionContext();
      await loadPageData();
      uni.showToast({ title: "已重置本机数据", icon: "none" });
    } catch (error) {
      // 重置本身已完成；重建失败时回到未登录视图，可点顶部卡片重试。
      uni.showToast({
        title: error instanceof Error ? error.message : "已重置，恢复登录失败，请点击顶部卡片登录",
        icon: "none",
        duration: 3000,
      });
    } finally {
      uni.hideLoading();
    }
  }


  return {
    currentTeam,
    currentUser,
    teamProfiles,
    shouldHideCreationEntrances,
    isLoading,
    isSwitchingTeam,
    myMatches,
    displayName,
    showInitialLoadingState,
    visibleErrorMessage,
    contentStyle,
    currentTeamJoinedDaysLabel,
    mineStats,
    walletSummary,
    settingsEntryVisible,
    confirmDialogVisible,
    confirmDialogState,
    handleConfirmPrimary,
    handleConfirmSecondary,
    handleConfirmClose,
    loadPageData,
    handleEditProfile,
    handleCompleteProfile,
    openSettings,
    handleLogin,
    handleLogout,
    handleClearLocalData,
    handleSwitchTeam,
    openTeamManage,
    openUserMatches,
    openMatchDetail,
    openBilling,
  };
}
