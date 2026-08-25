<script setup lang="ts">
import { computed } from "vue";
import type { BackendChallengeDetail } from "@/types/backend";

const props = defineProps<{
  detail: BackendChallengeDetail;
}>();

const hostTeamConfirmed = computed(() => props.detail.summary.challenge.host_team_id != null);
const guestTeamConfirmed = computed(() => !!props.detail.summary.guest_team_name);
const hostTeamName = computed(() => (hostTeamConfirmed.value ? props.detail.summary.host_team_name : "等待接约"));
const hostTeamInitial = computed(() => (hostTeamConfirmed.value ? hostTeamName.value.slice(0, 1) || "队" : "?"));
const hostTeamMeta = computed(() => (hostTeamConfirmed.value ? "主队" : "未确定"));
const guestTeamName = computed(() => props.detail.summary.guest_team_name || "等待接约");
const guestTeamInitial = computed(() => (guestTeamConfirmed.value ? guestTeamName.value.slice(0, 1) || "队" : "?"));
const guestTeamMeta = computed(() => (guestTeamConfirmed.value ? "已确定" : "未确定"));
</script>

<template>
  <view class="challenge-card">
    <view class="challenge-card-head">
      <view>
        <text class="challenge-card-title">对阵进度</text>
        <text class="challenge-card-caption">约成后会自动生成比赛，双方继续在比赛详情里报名。</text>
      </view>
    </view>

    <view class="vs-shell">
      <view class="vs-team">
        <view :class="['vs-logo', !hostTeamConfirmed ? 'vs-logo-muted' : '']">{{ hostTeamInitial }}</view>
        <text class="vs-name">{{ hostTeamName }}</text>
        <text class="vs-meta">{{ hostTeamMeta }}</text>
      </view>
      <text class="vs-divider">VS</text>
      <view class="vs-team">
        <view :class="['vs-logo', !guestTeamConfirmed ? 'vs-logo-muted' : '']">{{ guestTeamInitial }}</view>
        <text class="vs-name">{{ guestTeamName }}</text>
        <text class="vs-meta">{{ guestTeamMeta }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.challenge-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
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
  color: var(--neo-color-accent);
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
</style>
