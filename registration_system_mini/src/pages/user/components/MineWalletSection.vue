<script setup lang="ts">
defineProps<{
  walletSummary: {
    balanceLabel: string;
    totalExpenseLabel: string;
    latestExpenseLabel: string;
  };
  walletRecordTitle: string;
  walletRecordMeta: string;
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
    <view class="compact-record-card compact-record-card-light">
      <view class="compact-record-cover compact-record-cover-wallet" />
      <view class="compact-record-copy">
        <text class="compact-record-title">{{ walletRecordTitle }}</text>
        <text class="compact-record-meta">{{ walletRecordMeta }}</text>
      </view>
      <view class="wallet-chip">{{ walletSummary.totalExpenseLabel }}</view>
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
</style>
