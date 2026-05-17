<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import MineHeroProfile from "./components/MineHeroProfile.vue";
import MineMatchSection from "./components/MineMatchSection.vue";
import type { MineMatchSummary } from "./components/MineMatchSection.vue";
import MineMiniCards from "./components/MineMiniCards.vue";
import MineSkeleton from "./components/MineSkeleton.vue";
import MineWalletSection from "./components/MineWalletSection.vue";
import minePageBackgroundUrl from "@/static/backgrounds/mine-page-bg.jpg";
import { listActivities } from "@/api/activity";
import { getMyBalance } from "@/api/billing";
import { createTeamMembershipOrder, syncPaymentOrderStatus } from "@/api/payment";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { getTeamCreditTransactions } from "@/api/team";
import { getMyActivities } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import { clearSession } from "@/stores/appSession";
import { getAccessToken } from "@/utils/authStorage";
import { getCustomNavMetrics } from "@/utils/customNav";
import { getCurrentYearDateRange, isDateInRange } from "@/utils/dateRange";
import { isMockWxPaymentParams, isPaymentCancelled, normalizeWxPaymentParams, requestWxPayment } from "@/utils/payment";
import type { BackendTeamCreditTransaction } from "@/types/backend";
import {
  formatCreditTransactionLabel,
  formatDateTimeLabel,
  resolveUserDisplayHandle,
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
  refreshSessionContext,
} = useTeamContext();
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
const displayHandle = computed(() => resolveUserDisplayHandle(currentUser.value));
const showInitialLoadingState = computed(() => isLoading.value && !hasLoadedOnce.value);
const avatarToken = computed(() => displayName.value.slice(0, 1) || "我");
const teamBadgeLabel = computed(() => {
  if (!currentUser.value) return "未登录";
  return currentTeam.value?.myRoleLabel || "未加入球队";
});
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
  if (!joinedAt) return "0 天";

  const joinedTime = parseDateTime(joinedAt);
  if (!Number.isFinite(joinedTime)) return "0 天";

  const todayStart = todayStartTimestamp();
  const joinedStart = new Date(joinedTime);
  joinedStart.setHours(0, 0, 0, 0);
  const days = Math.max(1, Math.floor((todayStart - joinedStart.getTime()) / 86_400_000) + 1);
  return `${days} 天`;
});

function formatDateLabel(isoText: string) {
  const date = new Date(isoText.replace(" ", "T"));
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function statusClass(status: string) {
  if (status === "参加") return "user-status user-status-join";
  if (status === "请假") return "user-status user-status-leave";
  if (status === "缺席") return "user-status user-status-late";
  return "user-status user-status-pending";
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
    <image class="mine-page-bg" :src="minePageBackgroundUrl" mode="aspectFill" />
    <view class="mine-page-overlay" />
    <AppTabHeader title="我的" />
    <view class="mine-page-content" :style="contentStyle">
      <view class="mine-hero">

        <MineSkeleton v-if="showInitialLoadingState" />

        <MineHeroProfile
          v-else
          :available-identities="availableIdentities"
          :current-identity="currentIdentity"
          :current-user="currentUser"
          :current-team="currentTeam"
          :team-profiles="teamProfiles"
          :is-switching-team="isSwitchingTeam"
          :display-name="displayName"
          :display-handle="displayHandle"
          :avatar-token="avatarToken"
          :team-badge-label="teamBadgeLabel"
          :overview-digest="overviewDigest"
          :current-team-joined-days-label="currentTeamJoinedDaysLabel"
          @edit-profile="handleEditProfile"
          @login="handleLogin"
          @logout="handleLogout"
          @switch-identity="handleSwitchIdentity"
          @switch-team="handleSwitchTeam"
        />
      </view>

      <view class="mine-sections">
        <MineMatchSection
          :matches="myMatches"
          :status-class="statusClass"
          @open-all="openUserMatches"
          @open-match="openMatchDetail"
        />

        <MineWalletSection
          :wallet-summary="walletSummary"
          @open-billing="openBilling"
        />

        <MineMiniCards
          :current-team="currentTeam"
          :message-summary="messageSummary"
          :credit-card-summary="creditCardSummary"
          :is-paying-membership="isPayingMembership"
          @open-notifications="openNotifications"
          @renew-membership="handleMembershipRenewal"
        />

        <view class="mine-bottom-spacer" />

      </view>

      <BottomTabBar current="mine" />
    </view>
  </view>
</template>

<style scoped>
.mine-page {
  position: relative;
  min-height: 100vh;
  padding: 0 28rpx 0;
  background: #f3f5ee;
  box-sizing: border-box;
  overflow: hidden;
}

.mine-page-bg,
.mine-page-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
}

.mine-page-bg {
  z-index: 0;
  height: 1380rpx;
}

.mine-page-overlay {
  z-index: 1;
  height: 100vh;
  background:
    linear-gradient(180deg, rgba(253, 253, 248, 0.16) 0%, rgba(246, 247, 236, 0.38) 18%, rgba(241, 244, 232, 0.72) 42%, #f3f5ee 70%);
}

.mine-page-content {
  position: relative;
  z-index: 2;
}

.mine-hero {
  padding-bottom: 4rpx;
}

.mine-sections {
  margin-top: 16rpx;
}

.mine-bottom-spacer {
  height: calc(168rpx + env(safe-area-inset-bottom));
}
</style>
