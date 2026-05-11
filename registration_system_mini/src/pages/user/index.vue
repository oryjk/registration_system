<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import BottomTabBar from "@/components/BottomTabBar.vue";
import minePageBackgroundUrl from "@/static/backgrounds/mine-page-bg.jpg";
import { listActivities } from "@/api/activity";
import { getMyBalance, getMyBillingFlow } from "@/api/billing";
import { createTeamMembershipOrder, syncPaymentOrderStatus } from "@/api/payment";
import { useNotificationCenter } from "@/stores/notificationCenter";
import { getTeamCreditTransactions } from "@/api/team";
import { getMyActivities } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import { clearSession } from "@/stores/appSession";
import { getCustomNavMetrics } from "@/utils/customNav";
import { getCurrentYearDateRange, isDateInRange } from "@/utils/dateRange";
import { isMockWxPaymentParams, isPaymentCancelled, normalizeWxPaymentParams, requestWxPayment } from "@/utils/payment";
import type { BackendBillingFlowRecord, BackendTeamCreditTransaction } from "@/types/backend";
import {
  buildBillingSummary,
  formatCreditTransactionLabel,
  formatDateTimeLabel,
  resolveUserDisplayHandle,
  resolveUserDisplayName,
  toStandLabel,
} from "@/utils/viewModels";

const {
  currentTeam,
  currentUser,
  teamProfiles,
  switchTeam,
  ensureSessionReady,
} = useTeamContext();
const { unreadCount, syncUnreadCount, setUnreadCount } = useNotificationCenter();
const navMetrics = getCustomNavMetrics();

const isLoading = ref(false);
const isSwitchingTeam = ref(false);
const isPayingMembership = ref(false);
const hasLoadedOnce = ref(false);
const errorMessage = ref("");
const myMatches = ref<
  Array<{
    id: string;
    title: string;
    dateLabel: string;
    venue: string;
    myStatus: string;
  }>
>([]);
const billingRecords = ref<BackendBillingFlowRecord[]>([]);
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
const teamBadgeLabel = computed(() => currentTeam.value?.myRoleLabel || "未登录");
const messageSummary = computed(() =>
  unreadCount.value > 0 ? `约队发布、约成、取消等消息共 ${unreadCount.value} 条未读` : "约队发布、约成、取消等消息会先站内通知",
);
const latestBillingRecord = computed(() => billingRecords.value[0] ?? null);
const latestCreditRecord = computed(() => creditTransactions.value[0] ?? null);
const contentStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const walletRecordTitle = computed(
  () => latestBillingRecord.value?.description || latestBillingRecord.value?.type_name || "还没有账单流水",
);
const walletRecordMeta = computed(() =>
  latestBillingRecord.value
    ? `${formatDateTimeLabel(latestBillingRecord.value.created_at)} · ${latestBillingRecord.value.amount}`
    : "充值、扣费和结算会展示在这里",
);
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

function shouldShowWalletRecord(record: BackendBillingFlowRecord) {
  return record.record_type !== "penalty" && !record.type_name.includes("罚款");
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
    await ensureSessionReady();

    const activeTeamId = currentTeam.value?.id;
    const [activityPage, myActivityRecords, balance, billingFlow, teamCreditItems] = await Promise.all([
      listActivities({ page: 1, pageSize: 100 }),
      getMyActivities(),
      getMyBalance(),
      getMyBillingFlow(),
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

    const walletVisibleRecords = billingFlow.records.filter(shouldShowWalletRecord);
    billingRecords.value = walletVisibleRecords;
    creditTransactions.value = teamCreditItems;
    const billingSummary = buildBillingSummary(balance, billingFlow);
    const latestExpense = walletVisibleRecords.find((item) => Number(item.amount) < 0);
    walletSummary.value = {
      balanceLabel: billingSummary.balanceLabel,
      totalExpenseLabel: billingSummary.totalExpenseLabel,
      latestExpenseLabel: latestExpense ? `-${Math.abs(Number(latestExpense.amount)).toFixed(2)}` : "暂无支出",
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

function handleSwitchTeam(teamId: string) {
  if (!teamId || currentTeam.value?.id === teamId || isSwitchingTeam.value) {
    return;
  }

  switchTeam(teamId);
  void loadPageData({ preserveContent: true });
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

function resetPageState() {
  hasLoadedOnce.value = false;
  isSwitchingTeam.value = false;
  errorMessage.value = "已退出登录，请点击顶部卡片重新登录";
  myMatches.value = [];
  billingRecords.value = [];
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

        <view v-if="showInitialLoadingState" class="mine-skeleton-stack">
          <view class="mine-skeleton-profile">
            <view class="mine-skeleton-avatar" />
            <view class="mine-skeleton-copy">
              <view class="mine-skeleton-line mine-skeleton-line-title" />
              <view class="mine-skeleton-line mine-skeleton-line-body" />
              <view class="mine-skeleton-line mine-skeleton-line-short" />
            </view>
          </view>
          <view class="mine-skeleton-stats">
            <view class="mine-skeleton-stat" />
            <view class="mine-skeleton-stat" />
            <view class="mine-skeleton-stat" />
            <view class="mine-skeleton-stat" />
          </view>
        </view>

        <view v-else class="profile-shell">
          <view class="profile-main-row">
            <view class="profile-avatar">
              <image
                v-if="currentUser?.avatar_url"
                class="profile-avatar-image"
                :src="currentUser.avatar_url"
                mode="aspectFill"
              />
              <text v-else>{{ avatarToken }}</text>
            </view>
            <view class="profile-copy">
              <view class="profile-name-row">
                <text class="profile-name">{{ displayName }}</text>
                <text class="profile-badge">{{ teamBadgeLabel }}</text>
              </view>
              <text class="profile-handle">{{ displayHandle }}</text>
              <view class="profile-actions-row">
                <text class="profile-edit-chip" @tap.stop="handleEditProfile">编辑资料</text>
                <text class="profile-edit-chip profile-logout-chip" @tap.stop="handleLogout">退出登录</text>
              </view>
              <text class="profile-team-line">当前球队 · {{ currentTeam?.name || "未加入球队" }}</text>
            </view>
            <text class="profile-chevron">›</text>
          </view>

          <scroll-view class="team-switch-scroll" scroll-x>
            <view class="team-switch-row">
              <view
                v-for="team in teamProfiles"
                :key="team.id"
                :class="['team-chip', currentTeam?.id === team.id ? 'team-chip-active' : '', isSwitchingTeam ? 'team-chip-pending' : '']"
                @tap.stop="handleSwitchTeam(team.id)"
              >
                <text class="team-chip-name">{{ team.name }}</text>
              </view>
            </view>
          </scroll-view>

          <view class="profile-stats-row">
            <view class="profile-stat-item">
              <view class="profile-stat-icon">赛</view>
              <view class="profile-stat-copy">
                <text class="profile-stat-label">今年活动</text>
                <text class="profile-stat-value">{{ overviewDigest.activityCount }}<text class="profile-stat-unit"> 次</text></text>
              </view>
            </view>
            <view class="profile-stat-item">
              <view class="profile-stat-icon profile-stat-icon-blue">队</view>
              <view class="profile-stat-copy">
                <text class="profile-stat-label">加入球队</text>
                <text class="profile-stat-value">{{ overviewDigest.teamCount }}<text class="profile-stat-unit"> 支</text></text>
              </view>
            </view>
            <view class="profile-stat-item">
              <view class="profile-stat-icon profile-stat-icon-orange">时</view>
              <view class="profile-stat-copy">
                <text class="profile-stat-label">今年时长</text>
                <text class="profile-stat-value">{{ overviewDigest.totalHoursLabel }}</text>
              </view>
            </view>
            <view class="profile-stat-item">
              <view class="profile-stat-icon profile-stat-icon-green">天</view>
              <view class="profile-stat-copy">
                <text class="profile-stat-label">加入当前球队</text>
                <text class="profile-stat-value">{{ currentTeamJoinedDaysLabel }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="mine-sections">
        <view class="section-card">
          <view class="section-row">
            <view class="section-row-title">我的比赛</view>
            <view class="section-row-link" @tap="openUserMatches">全部比赛</view>
          </view>
          <view v-if="myMatches.length">
            <view
              v-for="match in myMatches"
              :key="match.id"
              class="compact-record-card"
              @tap="openMatchDetail(match.id)"
            >
              <view class="compact-record-cover" />
              <view class="compact-record-copy">
                <text :class="statusClass(match.myStatus)">{{ match.myStatus }}</text>
                <text class="compact-record-title">{{ match.title }}</text>
                <text class="compact-record-meta">{{ match.dateLabel }} · {{ match.venue }}</text>
              </view>
              <view class="compact-record-action">去报名</view>
            </view>
          </view>
          <view v-else class="compact-empty">当前球队下还没有可展示的比赛记录。</view>
        </view>

        <view class="section-card">
          <view class="section-row">
            <view class="section-row-title">我的钱包</view>
            <view class="section-row-link" @tap="openBilling">全部账单</view>
          </view>
          <view class="wallet-hero-row">
            <view>
              <text class="wallet-balance-label">当前余额</text>
              <text class="wallet-balance-value">{{ walletSummary.balanceLabel }}</text>
            </view>
            <view class="wallet-action" @tap="openBilling">查看账单</view>
          </view>
          <view class="compact-record-card compact-record-card-light">
            <view class="compact-record-cover compact-record-cover-wallet" />
            <view class="compact-record-copy">
              <text class="compact-record-title">{{ walletRecordTitle }}</text>
              <text class="compact-record-meta">{{ walletRecordMeta }}</text>
            </view>
            <view class="wallet-chip">{{ walletSummary.totalExpenseLabel }}</view>
          </view>
        </view>

        <view class="mini-card-grid">
          <view class="mini-card" @tap="openNotifications">
            <view class="mini-card-head">
              <text class="mini-card-title">消息中心</text>
              <text class="mini-card-link">进入</text>
            </view>
            <text class="mini-card-copy">{{ messageSummary }}</text>
          </view>

          <view class="mini-card">
            <view class="mini-card-head">
              <text class="mini-card-title">球队信用</text>
              <text class="mini-card-link">{{ currentTeam?.trustLabel || "待积累" }}</text>
            </view>
            <text class="mini-card-score">{{ currentTeam?.creditScore ?? 0 }} 分</text>
            <text class="mini-card-copy">{{ creditCardSummary }}</text>
            <view v-if="currentTeam?.canManageTeam" class="membership-action" @tap="handleMembershipRenewal">
              {{ isPayingMembership ? "续费中..." : "续费会员" }}
            </view>
          </view>
        </view>

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

.profile-shell {
  margin-top: 0;
  padding: 28rpx 26rpx 22rpx;
  border-radius: 34rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24rpx 52rpx rgba(17, 17, 17, 0.08);
  border: 2rpx solid rgba(255, 255, 255, 0.6);
}

.profile-main-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.profile-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  height: 116rpx;
  border-radius: 999rpx;
  background: #1b1c19;
  color: #c8ff00;
  font-size: 42rpx;
  font-weight: 900;
  overflow: hidden;
  flex-shrink: 0;
  border: 4rpx solid #edff6a;
  box-shadow: 0 14rpx 26rpx rgba(177, 205, 0, 0.25);
}

.profile-avatar-image {
  width: 100%;
  height: 100%;
}

.profile-copy {
  min-width: 0;
  flex: 1;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.profile-name {
  font-size: 40rpx;
  color: #10110f;
  font-weight: 900;
}

.profile-badge {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #5d81ff 0%, #4771f3 100%);
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 900;
}

.profile-handle,
.profile-team-line {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6c7168;
}

.profile-actions-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 10rpx;
}

.profile-edit-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 42rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #4f544c;
  font-size: 22rpx;
  font-weight: 800;
}

.profile-logout-chip {
  background: #fff0f1;
  color: #d14c63;
}

.profile-chevron {
  margin-left: 8rpx;
  color: #8f9488;
  font-size: 40rpx;
  line-height: 1;
}

.team-switch-scroll {
  margin-top: 18rpx;
}

.team-switch-row {
  display: inline-flex;
  gap: 12rpx;
}

.team-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 156rpx;
  height: 70rpx;
  padding: 0 22rpx;
  border-radius: 24rpx;
  background: rgba(239, 241, 234, 0.92);
}

.team-chip-pending {
  pointer-events: none;
}

.team-chip-active {
  background: #d8ff1d;
  box-shadow: 0 10rpx 20rpx rgba(169, 206, 0, 0.24);
}

.team-chip-name {
  display: block;
  font-size: 28rpx;
  color: #171814;
  font-weight: 900;
}

.team-chip-meta {
  display: none;
}

.profile-stats-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx 12rpx;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid rgba(20, 21, 18, 0.06);
}

.profile-stat-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.profile-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: rgba(200, 255, 0, 0.2);
  color: #4d6500;
  font-size: 24rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.profile-stat-icon-blue {
  background: rgba(81, 129, 255, 0.14);
  color: #4f74ec;
}

.profile-stat-icon-orange {
  background: rgba(255, 176, 48, 0.16);
  color: #d27e00;
}

.profile-stat-icon-green {
  background: rgba(21, 128, 61, 0.12);
  color: #15803d;
}

.profile-stat-copy {
  min-width: 0;
  flex: 1;
}

.profile-stat-label {
  display: block;
  font-size: 20rpx;
  color: #7a7f76;
  font-weight: 700;
}

.profile-stat-value {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #161713;
  font-weight: 900;
}

.profile-stat-unit {
  font-size: 20rpx;
}

.mine-sections {
  margin-top: 16rpx;
}

.section-card {
  margin-top: 18rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 2rpx solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 18rpx 40rpx rgba(17, 17, 17, 0.06);
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.section-row-title {
  font-size: 30rpx;
  color: #141512;
  font-weight: 900;
}

.section-row-link {
  color: #6a7067;
  font-size: 22rpx;
  font-weight: 800;
}

.compact-record-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: rgba(253, 254, 252, 0.94);
  box-shadow: inset 0 0 0 2rpx rgba(17, 17, 17, 0.04);
}

.compact-record-card-light {
  background: rgba(249, 250, 244, 0.98);
}

.compact-record-cover {
  width: 108rpx;
  height: 84rpx;
  border-radius: 20rpx;
  background:
    radial-gradient(circle at 24% 24%, rgba(200, 255, 0, 0.3), transparent 24%),
    linear-gradient(135deg, rgba(37, 41, 31, 0.98) 0%, rgba(59, 66, 48, 0.98) 100%);
  flex-shrink: 0;
}

.compact-record-cover-wallet {
  background:
    radial-gradient(circle at 24% 24%, rgba(255, 213, 50, 0.26), transparent 24%),
    linear-gradient(135deg, rgba(31, 35, 28, 0.95) 0%, rgba(79, 86, 63, 0.95) 100%);
}

.compact-record-copy {
  min-width: 0;
  flex: 1;
}

.compact-record-title {
  display: block;
  margin-top: 8rpx;
  font-size: 30rpx;
  color: #141512;
  font-weight: 900;
  line-height: 1.3;
}

.compact-record-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #6a7067;
  line-height: 1.5;
}

.compact-record-action,
.wallet-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 138rpx;
  height: 68rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #d6ff1f;
  color: #151611;
  font-size: 28rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.wallet-hero-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 18rpx;
}

.wallet-balance-label {
  display: block;
  font-size: 22rpx;
  color: #7a7f76;
  font-weight: 700;
}

.wallet-balance-value {
  display: block;
  margin-top: 8rpx;
  font-size: 54rpx;
  color: #141512;
  font-weight: 900;
}

.wallet-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 112rpx;
  height: 54rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  background: #eff6d7;
  color: #4e6900;
  font-size: 24rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.mini-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 18rpx;
}

.mine-bottom-spacer {
  height: calc(168rpx + env(safe-area-inset-bottom));
}

.mini-card {
  padding: 22rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18rpx 34rpx rgba(17, 17, 17, 0.05);
}

.mini-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.mini-card-title {
  font-size: 28rpx;
  color: #151611;
  font-weight: 900;
}

.mini-card-link {
  font-size: 22rpx;
  color: #6a7067;
  font-weight: 800;
}

.mini-card-score {
  display: block;
  margin-top: 14rpx;
  font-size: 42rpx;
  color: #171814;
  font-weight: 900;
}

.mini-card-copy {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #6d7269;
  line-height: 1.5;
}

.membership-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 54rpx;
  margin-top: 16rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #10110f;
  font-size: 24rpx;
  font-weight: 900;
}

.user-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96rpx;
  height: 44rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 800;
}

.user-status-join {
  background: #eef8d6;
  color: #456100;
}

.user-status-leave {
  background: #f1f3ef;
  color: #5d625a;
}

.user-status-late {
  background: #fff1df;
  color: #ad6900;
}

.user-status-pending {
  background: #eceef3;
  color: #5d6475;
}

.compact-empty {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #72776e;
  line-height: 1.6;
}

.mine-skeleton-stack,
.mine-skeleton-profile,
.mine-skeleton-line,
.mine-skeleton-avatar,
.mine-skeleton-stat {
  position: relative;
  overflow: hidden;
}

.mine-skeleton-stack {
  padding: 28rpx;
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 24rpx 48rpx rgba(15, 23, 42, 0.08);
}

.mine-skeleton-profile {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.mine-skeleton-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 36rpx;
  background: #e5eadf;
  flex-shrink: 0;
}

.mine-skeleton-copy {
  flex: 1;
  min-width: 0;
}

.mine-skeleton-line {
  height: 24rpx;
  border-radius: 999rpx;
  background: #e5eadf;
}

.mine-skeleton-line + .mine-skeleton-line {
  margin-top: 16rpx;
}

.mine-skeleton-line-title {
  width: 58%;
  height: 34rpx;
}

.mine-skeleton-line-body {
  width: 76%;
}

.mine-skeleton-line-short {
  width: 46%;
}

.mine-skeleton-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 28rpx;
}

.mine-skeleton-stat {
  height: 112rpx;
  border-radius: 24rpx;
  background: #eef2e8;
}

.mine-skeleton-profile::after,
.mine-skeleton-line::after,
.mine-skeleton-avatar::after,
.mine-skeleton-stat::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.78) 50%, transparent 100%);
  animation: mine-skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes mine-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
