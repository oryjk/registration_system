<script setup lang="ts">
import type { TeamProfileViewModel } from "@/types/viewModels";

defineProps<{
  currentTeam: TeamProfileViewModel | null;
  messageSummary: string;
  creditCardSummary: string;
  isPayingMembership: boolean;
}>();

const emit = defineEmits<{
  (event: "openNotifications"): void;
  (event: "renewMembership"): void;
}>();

function handleOpenNotifications() {
  emit("openNotifications");
}

function handleRenewMembership() {
  emit("renewMembership");
}
</script>

<template>
  <view class="mini-card-grid">
    <view class="mini-card" @tap="handleOpenNotifications">
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
      <view v-if="currentTeam?.canManageTeam" class="membership-action" @tap="handleRenewMembership">
        {{ isPayingMembership ? "续费中..." : "续费会员" }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.mini-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 18rpx;
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
</style>
