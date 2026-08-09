<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import type { NeoTagTone } from "@/components/neo";
import MineProfileHero from "./components/MineProfileHero.vue";
import MineTeamIdentityPanel from "./components/MineTeamIdentityPanel.vue";
import MineStatsGrid from "./components/MineStatsGrid.vue";
import MineMatchSection from "./components/MineMatchSection.vue";
import MineServiceGrid from "./components/MineServiceGrid.vue";
import MineSkeleton from "./components/MineSkeleton.vue";
import MineWalletSection from "./components/MineWalletSection.vue";
import type { MineMatchSummary, MineStatItem } from "./mineTypes";
import { listActivities } from "@/api/activity";
import { getMyBalance } from "@/api/billing";
import { createTeamMembershipOrder, syncPaymentOrderStatus } from "@/api/payment";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { getTeamCreditTransactions } from "@/api/team";
import { getMyActivities } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { clearSession } from "@/stores/appSession";
import { getAccessToken } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { getCurrentYearDateRange, isDateInRange } from "@/utils/dateRange";
import { formatDateLabel } from "@/utils/datetime";
import { attendanceStatusTone } from "@/utils/statusTone";
import { isMockWxPaymentParams, isPaymentCancelled, normalizeWxPaymentParams, requestWxPayment } from "@/utils/payment";
import type { BackendTeamCreditTransaction } from "@/types/backend";
import {
  formatCreditTransactionLabel,
  formatDateTimeLabel,
  resolveUserDisplayName,
  toStandLabel,
} from "@/utils/viewModels";

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
const { unreadCount, syncUnreadCount, setUnreadCount } = useNotificationCenter();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const isSwitchingTeam = ref(false);
const isPayingMembership = ref(false);
const hasLoadedOnce = ref(false);
const errorMessage = ref("");
const myMatches = ref<MineMatchSummary[]>([]);
const creditTransactions = ref<BackendTeamCreditTransaction[]>([]);
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

function matchStatusTone(status: string): NeoTagTone {
  switch (attendanceStatusTone(status)) {
    case "join":
      return "green";
    case "leave":
      return "muted";
    case "late":
      return "amber";
    default:
      return "blue";
  }
}

function parseDateTime(value: string) {
  return new Date(value.replace(" ", "T")).getTime();
}

function todayStartTimestamp() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
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
    if (!getAccessToken()) {
      resetPageState("登录后可以查看你的比赛、出勤、钱包和球队数据");
      hasLoadedOnce.value = true;
      return;
    }

    await ensureSessionReady();

    const activeTeamId = currentTeam.value?.id;
    if (activeTeamId) {
      await ensureTeamDetailLoaded(activeTeamId);
    }
    const [activityPage, myActivityRecords, balance, teamCreditItems] = await Promise.all([
      listActivities({ page: 1, pageSize: 100 }),
      getMyActivities(),
      getMyBalance(),
      activeTeamId ? getTeamCreditTransactions(activeTeamId, 5) : Promise.resolve([]),
    ]);
    await syncUnreadCount({ skipEnsure: true });

    const recordByActivityId = Object.fromEntries(
      myActivityRecords.map((item) => [item.activity_id, item]),
    );
    const currentYearDateRange = getCurrentYearDateRange();
    const relatedActivityIds = new Set(myActivityRecords.map((item) => item.activity_id));
    const todayStart = todayStartTimestamp();
    const isActivityRelated = (activity: (typeof activityPage.items)[number]) =>
      relatedActivityIds.has(activity.id) ||
      (!!activeTeamId &&
        (activity.home_team_id === activeTeamId || activity.away_team_id === activeTeamId));
    const allRelatedActivities = activityPage.items.filter(isActivityRelated);
    const currentYearRelatedActivities = allRelatedActivities.filter((activity) =>
      isDateInRange(activity.holding_date, currentYearDateRange),
    );
    const futureTeamRelatedActivities = allRelatedActivities
      .filter(
        (activity) =>
          parseDateTime(activity.holding_date) >= todayStart &&
          activity.status !== 2 &&
          activity.status !== 3,
      )
      .sort((left, right) => left.holding_date.localeCompare(right.holding_date));

    myMatches.value = futureTeamRelatedActivities
      .slice(0, 2)
      .map((activity) => ({
        id: activity.id,
        title: activity.name,
        dateLabel: formatDateLabel(activity.holding_date),
        venue: activity.location,
        myStatus: toStandLabel(recordByActivityId[activity.id]?.stand ?? 0),
      }));

    const totalHours = currentYearRelatedActivities.length * 2;

    overviewDigest.value = {
      activityCount: currentYearRelatedActivities.length,
      teamCount: teamProfiles.value.length,
      totalHoursLabel: `${Math.round(totalHours)} h`,
    };

    creditTransactions.value = teamCreditItems;
    walletSummary.value = {
      balanceLabel: balance ? `¥${Number(balance.balance).toFixed(2)}` : "¥0.00",
      totalExpenseLabel: balance ? `¥${Number(balance.total_expense).toFixed(2)}` : "¥0.00",
      latestExpenseLabel: "进入账单查看",
    };
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
  if (!teamId || currentTeam.value?.id === teamId || isSwitchingTeam.value) {
    return;
  }

  switchTeam(teamId);
  void loadPageData({ preserveContent: true });
}

function handleSwitchIdentity(identityId: string) {
  if (!identityId || currentIdentity.value?.id === identityId) {
    return;
  }

  switchIdentity(identityId);
}

function handleEditProfile() {
  uni.navigateTo({
    url: "/pages/profile/setup/index?mode=edit",
  });
}

function openTeamManage(teamId?: number) {
  const targetTeam = teamId ? teamProfiles.value.find((team) => team.id === teamId) : currentTeam.value;
  if (!targetTeam?.canManageTeam) {
    uni.showToast({
      title: "只有队长或领队可以管理球队",
      icon: "none",
    });
    return;
  }

  if (teamId && currentTeam.value?.id !== teamId) {
    switchTeam(teamId);
  }

  uni.navigateTo({
    url: "/pages/teams/manage/index",
  });
}

function openNotifications() {
  uni.navigateTo({
    url: "/pages/notifications/index",
  });
}

function openUserMatches() {
  uni.navigateTo({
    url: "/pages/user/matches/index",
  });
}

function openMatchDetail(matchId: string) {
  uni.navigateTo({
    url: `/pages/matches/detail?id=${matchId}`,
  });
}

function openBilling() {
  uni.navigateTo({
    url: "/pages/billing/index",
  });
}

function confirmDialog(options: { title: string; content: string }): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: options.title,
      content: options.content,
      confirmText: "确认",
      cancelText: "取消",
      success: (result) => {
        resolve(!!result.confirm);
      },
      fail: () => resolve(false),
    });
  });
}

function resetPageState(message = "已退出登录，请点击顶部卡片重新登录") {
  hasLoadedOnce.value = false;
  isSwitchingTeam.value = false;
  errorMessage.value = message;
  myMatches.value = [];
  creditTransactions.value = [];
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

function handleSessionLoginCompleted() {
  void loadPageData();
}

async function handleLogin() {
  if (currentUser.value) {
    return;
  }

  uni.showLoading({
    title: "登录中...",
    mask: true,
  });

  try {
    await refreshSessionContext();
    await loadPageData();
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "登录失败",
      icon: "none",
    });
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
  uni.showToast({
    title: "已退出登录",
    icon: "none",
  });
}

async function handleMembershipRenewal() {
  if (!currentTeam.value || isPayingMembership.value) {
    return;
  }

  if (!currentTeam.value.canManageTeam) {
    uni.showToast({
      title: "只有队长或领队可以续费球队会员",
      icon: "none",
    });
    return;
  }

  isPayingMembership.value = true;
  try {
    const order = await createTeamMembershipOrder({
      team_id: currentTeam.value.id,
      months: 1,
      note: "小程序球队会员续费",
    });
    const paymentParams = normalizeWxPaymentParams(order.params);
    if (paymentParams && !isMockWxPaymentParams(paymentParams)) {
      await requestWxPayment(paymentParams);
    }
    const result = await syncPaymentOrderStatus(order.order_no);
    await loadPageData({ preserveContent: true });
    uni.showToast({
      title: result.paid || paymentParams ? "会员续费已提交" : "续费订单已创建",
      icon: "none",
    });
  } catch (error) {
    if (isPaymentCancelled(error)) {
      uni.showToast({
        title: "已取消支付",
        icon: "none",
      });
    } else {
      uni.showToast({
        title: error instanceof Error ? error.message : "会员续费失败",
        icon: "none",
      });
    }
  } finally {
    isPayingMembership.value = false;
  }
}

onShow(() => {
  uni.hideTabBar({ animation: false });
  void loadPageData();
});

onLoad(() => {
  uni.$on("session:login-completed", handleSessionLoginCompleted);
});

onUnload(() => {
  uni.$off("session:login-completed", handleSessionLoginCompleted);
});
</script>

<template>
  <view class="mine-page">
    <AppTabHeader title="我的" />
    <view class="mine-page-content" :style="contentStyle">
      <MineSkeleton v-if="showInitialLoadingState" />

      <template v-else>
        <MineProfileHero
          :current-user="currentUser"
          :display-name="displayName"
          :team-joined-days-label="currentTeamJoinedDaysLabel"
          @edit-profile="handleEditProfile"
          @login="handleLogin"
          @logout="handleLogout"
        />

        <view v-if="visibleErrorMessage" class="mine-error-banner">
          <text class="mine-error-banner__label">数据加载失败</text>
          <text class="mine-error-banner__message">{{ visibleErrorMessage }}</text>
        </view>

        <template v-if="currentUser">
          <MineTeamIdentityPanel
            :available-identities="availableIdentities"
            :current-identity="currentIdentity"
            :current-team="currentTeam"
            :team-profiles="teamProfiles"
            :is-switching-team="isSwitchingTeam"
            @manage-team="openTeamManage"
            @switch-identity="handleSwitchIdentity"
            @switch-team="handleSwitchTeam"
          />

          <MineStatsGrid :items="mineStats" />

          <MineMatchSection
            :matches="myMatches"
            :status-tone="matchStatusTone"
            @open-all="openUserMatches"
            @open-match="openMatchDetail"
          />

          <MineWalletSection
            v-if="!shouldHideCreationEntrances"
            :wallet-summary="walletSummary"
            @open-billing="openBilling"
          />

          <MineServiceGrid
            :current-team="currentTeam"
            :message-summary="messageSummary"
            :credit-card-summary="creditCardSummary"
            :is-paying-membership="isPayingMembership"
            @open-notifications="openNotifications"
            @renew-membership="handleMembershipRenewal"
          />
        </template>
      </template>

      <view class="mine-bottom-spacer" />

      <BottomTabBar current="mine" />
    </view>
  </view>
</template>

<style scoped>
.mine-page {
  position: relative;
  min-height: 100vh;
  padding: 0 28rpx 0;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.mine-page-content {
  position: relative;
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

.mine-error-banner {
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-danger-soft);
  box-shadow: 6rpx 6rpx 0 var(--neo-color-text);
}

.mine-error-banner__label,
.mine-error-banner__message {
  display: block;
}

.mine-error-banner__label {
  color: var(--neo-color-text);
  font-size: 23rpx;
  font-weight: 900;
}

.mine-error-banner__message {
  margin-top: 6rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.mine-bottom-spacer {
  height: calc(168rpx + env(safe-area-inset-bottom));
}
</style>
