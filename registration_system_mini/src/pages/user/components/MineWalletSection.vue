<script setup lang="ts">
defineProps<{
  walletSummary: {
    balanceLabel: string;
    totalExpenseLabel: string;
    latestExpenseLabel: string;
  };
}>();

const emit = defineEmits<{
  (event: "openBilling"): void;
}>();

function handleOpenBilling() {
  emit("openBilling");
}
</script>

<template>
  <view class="section-card">
    <view class="section-row">
      <view class="section-row-title">我的钱包</view>
      <view class="section-row-link" @tap="handleOpenBilling">全部账单</view>
    </view>
    <view class="wallet-hero-row">
      <view>
        <text class="wallet-balance-label">当前余额</text>
        <text class="wallet-balance-value">{{ walletSummary.balanceLabel }}</text>
      </view>
      <view class="wallet-action" @tap="handleOpenBilling">查看账单</view>
    </view>
  </view>
</template>

<style scoped>
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

</style>
