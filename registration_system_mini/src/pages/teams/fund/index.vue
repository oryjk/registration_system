<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import { useTeamFundPage } from "./useTeamFundPage";

const { themePageStyle } = useAccentTheme();

const {
  pageStyle,
  teamName,
  isLoading,
  errorMessage,
  paying,
  amountInput,
  amountError,
  balanceLabel,
  totalPriceLabel,
  loadTeam,
  handleMembershipPayment,
} = useTeamFundPage();
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="team-fund-page" :style="pageStyle">
    <AppTabHeader :title="teamName" showBack />

    <view class="team-fund-content">
      <view v-if="errorMessage" class="state-card" @tap="loadTeam">
        <text class="state-text">{{ errorMessage }}，点击重试</text>
      </view>
      <view v-else-if="isLoading" class="state-card">
        <text class="state-text">正在加载队费信息...</text>
      </view>

      <view v-else class="recharge-card">
        <view class="balance-hero">
          <text class="balance-hero-label">我的队内余额</text>
          <view class="balance-hero-amount">
            <text class="balance-hero-symbol">¥</text>
            <text class="balance-hero-value">{{ balanceLabel }}</text>
          </view>
          <text class="balance-hero-copy">队费充值计入你在本队的个人账户</text>
        </view>
        <view class="recharge-amount">
          <input
            v-model="amountInput"
            class="recharge-input"
            type="digit"
            placeholder="输入缴纳金额（元）"
          />
          <text v-if="amountError" class="recharge-error">{{ amountError }}</text>
        </view>
        <view class="recharge-total">
          <text class="recharge-total-label">应付</text>
          <text class="recharge-total-value">{{ totalPriceLabel }}</text>
        </view>
        <NeoButton
          block
          :loading="paying"
          :disabled="paying"
          @click="handleMembershipPayment"
        >
          {{ paying ? "支付中..." : "微信支付缴纳队费" }}
        </NeoButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
.team-fund-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.team-fund-content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.state-card,
.recharge-card {
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
}

.state-card {
  padding: 40rpx 28rpx;
  text-align: center;
}

.state-text {
  color: var(--neo-color-text-muted);
  font-size: 28rpx;
  font-weight: 800;
}

.recharge-card {
  padding: 28rpx;
}

.balance-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6rpx;
  padding: 24rpx;
  margin-bottom: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-success);
}

.balance-hero-label {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.balance-hero-amount {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
}

.balance-hero-symbol {
  color: var(--neo-color-text);
  font-size: 34rpx;
  font-weight: 900;
}

.balance-hero-value {
  color: var(--neo-color-text);
  font-size: 64rpx;
  line-height: 1.1;
  font-weight: 950;
}

.balance-hero-copy {
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
}

.recharge-amount {
  margin-top: 22rpx;
}

.recharge-input {
  height: 88rpx;
  padding: 0 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.recharge-error {
  display: block;
  margin-top: 10rpx;
  color: var(--neo-color-danger);
  font-size: 22rpx;
  font-weight: 700;
}

.recharge-total {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin: 22rpx 4rpx;
}

.recharge-total-label {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
}

.recharge-total-value {
  color: var(--neo-color-text);
  font-size: 44rpx;
  font-weight: 950;
}

/* #ifdef H5 */
.team-fund-page {
  width: 100%;
  max-width: 750rpx;
  margin: 0 auto;
}

.team-fund-page :deep(.app-tab-header-shell) {
  left: 50%;
  right: auto;
  width: 100%;
  max-width: 750rpx;
  transform: translateX(-50%);
}
/* #endif */
</style>
