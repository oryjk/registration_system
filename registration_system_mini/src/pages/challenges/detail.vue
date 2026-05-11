<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { acceptChallenge, cancelChallenge, getChallengeDetail } from "@/api/challenge";
import { useTeamContext } from "@/stores/teamContext";
import type { BackendChallenge, BackendChallengeDetail } from "@/types/backend";
import { getCustomNavMetrics } from "@/utils/customNav";
import { buildChallengeCards, formatDateTimeLabel } from "@/utils/viewModels";

const { currentTeam, ensureSessionReady } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const challengeId = ref("");
const isLoading = ref(false);
const actionLoading = ref(false);
const errorMessage = ref("");
const detail = ref<BackendChallengeDetail | null>(null);

const card = computed(() => {
  if (!detail.value) return null;
  const summary = detail.value.summary;
  const canAccept =
    summary.challenge.kind === "team"
      ? !!currentTeam.value?.canManageTeam &&
        summary.challenge.status === "open" &&
        summary.challenge.host_team_id !== currentTeam.value?.id
      : summary.challenge.status === "open" &&
        !summary.current_user_joined &&
        summary.accepted_count < summary.challenge.players_per_team;
  const [item] = buildChallengeCards([
    {
      ...summary,
      current_team_relation:
        summary.challenge.host_team_id === currentTeam.value?.id
          ? "host"
          : summary.challenge.guest_team_id === currentTeam.value?.id
            ? "guest"
            : "viewer",
      can_accept: canAccept,
    },
  ]);
  return item;
});

const canCancel = computed(
  () =>
    !!detail.value &&
    !!currentTeam.value &&
    currentTeam.value.canManageTeam &&
    detail.value.summary.challenge.host_team_id === currentTeam.value.id &&
    detail.value.summary.challenge.status === "open",
);
const canAccept = computed(() => !!card.value?.canAccept);
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

async function loadPageData() {
  if (!challengeId.value) return;

  isLoading.value = true;
  errorMessage.value = "";
  try {
    await ensureSessionReady();
    detail.value = await getChallengeDetail(challengeId.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "约队详情加载失败";
  } finally {
    isLoading.value = false;
  }
}

function applyAcceptedChallengeDetail(challenge: BackendChallenge) {
  if (!detail.value) return;

  const isIndividual = challenge.kind === "individual";
  detail.value = {
    ...detail.value,
    summary: {
      ...detail.value.summary,
      challenge,
      guest_team_name: isIndividual ? detail.value.summary.guest_team_name : currentTeam.value?.name ?? detail.value.summary.guest_team_name,
      guest_team_credit_score: isIndividual ? detail.value.summary.guest_team_credit_score : currentTeam.value?.creditScore ?? detail.value.summary.guest_team_credit_score,
      guest_team_trust_label: isIndividual ? detail.value.summary.guest_team_trust_label : currentTeam.value?.trustLabel ?? detail.value.summary.guest_team_trust_label,
      current_team_relation: isIndividual ? detail.value.summary.current_team_relation : "guest",
      accepted_count: isIndividual ? detail.value.summary.accepted_count + 1 : detail.value.summary.accepted_count,
      current_user_joined: isIndividual ? true : detail.value.summary.current_user_joined,
      can_accept: false,
    },
    activity: challenge.activity_id
      ? {
          id: challenge.activity_id,
          name: challenge.title,
          holding_date: challenge.holding_date,
          start_time: challenge.start_time,
          end_time: challenge.end_time,
          location: challenge.location,
          home_team_id: challenge.host_team_id,
          away_team_id: challenge.guest_team_id,
          players_per_team: challenge.players_per_team,
        }
      : detail.value.activity,
  };
}

function applyCancelledChallengeDetail(challenge: BackendChallenge) {
  if (!detail.value) return;

  detail.value = {
    ...detail.value,
    summary: {
      ...detail.value.summary,
      challenge,
      can_accept: false,
    },
  };
}

async function handleAccept() {
  if (!card.value || !canAccept.value || actionLoading.value) return;

  actionLoading.value = true;
  try {
    const challenge = await acceptChallenge(challengeId.value, card.value.kind === "team" ? currentTeam.value?.id : undefined);
    applyAcceptedChallengeDetail(challenge);
    uni.showToast({
      title: card.value.kind === "team" ? "接约成功" : "报名成功",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "接约失败",
      icon: "none",
    });
  } finally {
    actionLoading.value = false;
  }
}

async function handleCancel() {
  if (!canCancel.value || actionLoading.value) return;

  actionLoading.value = true;
  try {
    const challenge = await cancelChallenge(challengeId.value);
    applyCancelledChallengeDetail(challenge);
    uni.showToast({
      title: "约队已取消",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "取消失败",
      icon: "none",
    });
  } finally {
    actionLoading.value = false;
  }
}

function openActivities() {
  uni.switchTab({
    url: "/pages/activities/index",
  });
}

function openMatchDetail(matchId: string) {
  uni.navigateTo({
    url: `/pages/matches/detail?id=${matchId}`,
  });
}

onLoad((options) => {
  challengeId.value = options?.id ?? "";
  void loadPageData();
});
</script>

<template>
  <view class="challenge-detail-page" :style="pageStyle">
    <AppTabHeader title="约队详情" showBack />

    <view v-if="errorMessage" class="challenge-empty">{{ errorMessage }}</view>
    <view v-else-if="isLoading" class="challenge-empty">正在加载约队详情...</view>

    <view v-if="detail && card">
      <view class="challenge-hero">
        <view class="challenge-hero-copy">
          <text class="challenge-hero-tag">约队详情</text>
          <text class="challenge-hero-title">{{ card.title }}</text>
          <text class="challenge-hero-meta">{{ card.hostTeamName }} · {{ card.trustLabel }} · 信用 {{ card.creditScore }}</text>
        </view>
        <view class="challenge-hero-side">
          <text :class="['challenge-hero-status', `challenge-hero-status-${card.statusTone}`]">{{ card.statusLabel }}</text>
          <text class="challenge-hero-price">{{ card.priceLabel }}</text>
        </view>
      </view>

      <view class="challenge-card">
        <view class="challenge-card-head">
          <view>
            <text class="challenge-card-title">约队主信息</text>
            <text class="challenge-card-caption">先看时间、场地、费用，再决定是否接约。</text>
          </view>
        </view>
        <view class="challenge-grid">
          <view class="challenge-grid-item">
            <text class="challenge-grid-label">比赛时间</text>
            <text class="challenge-grid-value">{{ card.monthDayLabel }} {{ card.weekdayLabel }} {{ card.timeRangeLabel }}</text>
          </view>
          <view class="challenge-grid-item">
            <text class="challenge-grid-label">场地</text>
            <text class="challenge-grid-value">{{ card.venue }}</text>
          </view>
          <view class="challenge-grid-item">
            <text class="challenge-grid-label">比赛规格</text>
            <text class="challenge-grid-value">{{ card.formatLabel }}</text>
          </view>
          <view class="challenge-grid-item">
            <text class="challenge-grid-label">预计费用</text>
            <text class="challenge-grid-value">{{ card.feeLabel }}</text>
          </view>
          <view class="challenge-grid-item">
            <text class="challenge-grid-label">当前关系</text>
            <text class="challenge-grid-value">{{ card.relationLabel }}</text>
          </view>
          <view class="challenge-grid-item">
            <text class="challenge-grid-label">创建时间</text>
            <text class="challenge-grid-value">{{ formatDateTimeLabel(detail.summary.challenge.created_at) }}</text>
          </view>
        </view>
        <view v-if="card.note" class="challenge-note">{{ card.note }}</view>
      </view>

      <view class="challenge-card">
        <view class="challenge-card-head">
          <view>
            <text class="challenge-card-title">对阵进度</text>
            <text class="challenge-card-caption">约成后会自动生成比赛，双方继续在比赛详情里报名。</text>
          </view>
        </view>

        <view class="vs-shell">
          <view class="vs-team">
            <view class="vs-logo">{{ detail.summary.host_team_name.slice(0, 1) }}</view>
            <text class="vs-name">{{ detail.summary.host_team_name }}</text>
            <text class="vs-meta">主队</text>
          </view>
          <text class="vs-divider">VS</text>
          <view class="vs-team">
            <view class="vs-logo vs-logo-muted">{{ detail.summary.guest_team_name ? detail.summary.guest_team_name.slice(0, 1) : "?" }}</view>
            <text class="vs-name">{{ detail.summary.guest_team_name || "等待接约" }}</text>
            <text class="vs-meta">{{ detail.summary.guest_team_name ? "已确定" : "未确定" }}</text>
          </view>
        </view>
      </view>

      <view class="challenge-actions">
        <view class="challenge-ghost-button" @tap="openActivities">回大厅</view>
        <view
          v-if="detail.activity"
          class="challenge-primary-button"
          @tap="openMatchDetail(detail.activity.id)"
        >
          去比赛详情
        </view>
        <view v-else-if="canAccept" class="challenge-primary-button" @tap="handleAccept">
          {{ actionLoading ? "处理中..." : "以当前球队接约" }}
        </view>
        <view v-else-if="canCancel" class="challenge-danger-button" @tap="handleCancel">
          {{ actionLoading ? "处理中..." : "取消约队" }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.challenge-detail-page {
  min-height: 100vh;
  padding: 30rpx 28rpx 100rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.14), transparent 24%),
    linear-gradient(180deg, #fbfcf7 0%, #f3f5ee 100%);
  box-sizing: border-box;
}

.challenge-hero,
.challenge-card {
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.challenge-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 28rpx;
  border-radius: 34rpx;
}

.challenge-hero-tag {
  display: inline-flex;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef8d6;
  color: #506900;
  font-size: 22rpx;
  font-weight: 900;
}

.challenge-hero-title {
  display: block;
  margin-top: 14rpx;
  font-size: 42rpx;
  line-height: 1.3;
  color: #131410;
  font-weight: 900;
}

.challenge-hero-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #6d7269;
}

.challenge-hero-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
}

.challenge-hero-status {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.challenge-hero-status-open {
  background: #eef8d6;
  color: #4f6800;
}

.challenge-hero-status-matched {
  background: #e9efff;
  color: #4763d2;
}

.challenge-hero-status-cancelled {
  background: #ffe9ec;
  color: #cf455d;
}

.challenge-hero-price {
  font-size: 46rpx;
  color: #131410;
  font-weight: 900;
}

.challenge-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 30rpx;
}

.challenge-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.challenge-card-title {
  display: block;
  font-size: 30rpx;
  color: #171814;
  font-weight: 900;
}

.challenge-card-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #737870;
}

.challenge-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 22rpx;
}

.challenge-grid-item {
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f6f7f2;
}

.challenge-grid-label {
  display: block;
  font-size: 22rpx;
  color: #767b74;
}

.challenge-grid-value {
  display: block;
  margin-top: 10rpx;
  font-size: 28rpx;
  color: #171814;
  font-weight: 800;
  line-height: 1.5;
}

.challenge-note {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  background: #f1f4ea;
  font-size: 24rpx;
  color: #5e635b;
  line-height: 1.6;
}

.vs-shell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 22rpx;
}

.vs-team {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vs-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  border-radius: 999rpx;
  background: #161714;
  color: #c8ff00;
  font-size: 40rpx;
  font-weight: 900;
}

.vs-logo-muted {
  background: #dfe3d9;
  color: #5d6458;
}

.vs-name {
  margin-top: 12rpx;
  text-align: center;
  font-size: 28rpx;
  color: #171814;
  font-weight: 800;
}

.vs-meta {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #767b74;
}

.vs-divider {
  font-size: 38rpx;
  color: #171814;
  font-weight: 900;
}

.challenge-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.challenge-primary-button,
.challenge-ghost-button,
.challenge-danger-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 82rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 900;
}

.challenge-primary-button {
  background: #c8ff00;
  color: #131410;
}

.challenge-ghost-button {
  background: #ffffff;
  border: 2rpx solid #d9ddd3;
  color: #171814;
}

.challenge-danger-button {
  background: #ffe9ec;
  color: #cf455d;
}

.challenge-empty {
  padding: 26rpx;
  border-radius: 28rpx;
  background: #ffffff;
  color: #6c7168;
  font-size: 28rpx;
  line-height: 1.6;
}
</style>
