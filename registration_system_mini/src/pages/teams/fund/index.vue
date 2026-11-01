<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
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
  <view class="app-theme-scope ui-card-page team-fund-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader :title="teamName" showBack />

    <view class="team-fund-content">
      <view v-if="errorMessage" class="state-card ui-card-panel" @tap="loadTeam">
        <text class="state-text">{{ errorMessage }}，点击重试</text>
      </view>
      <view v-else-if="isLoading" class="state-card ui-card-panel">
        <text class="state-text">正在加载队费信息...</text>
      </view>

      <view v-else class="recharge-card ui-card-panel">
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
        <AppButton
          block
          :loading="paying"
          :disabled="paying"
          @click="handleMembershipPayment"
        >
          {{ paying ? "支付中..." : "微信支付缴纳队费" }}
        </AppButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/page-surfaces.css";
@import "@/styles/list-surfaces.css";
.team-fund-page {
  min-height: 100vh;
  padding: 0 28rpx 96rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.team-fund-content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.state-card,
.recharge-card {
  /* #ifndef MP-WEIXIN */
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
  /* #endif */
}

.state-card {
  /* #ifndef MP-WEIXIN */
  padding: 40rpx 28rpx;
  /* #endif */
  text-align: center;
}

.state-text {
  color: var(--ui-color-text-muted);
  font-size: 28rpx;
  font-weight: 500;
}

.recharge-card {
  /* #ifndef MP-WEIXIN */
  padding: 28rpx;
  /* #endif */
}
.balance-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6rpx;

  padding: 0 0 24rpx;
  margin-bottom: 22rpx;

  border: 0;

  border-radius: 0;

  background: transparent;
  border-bottom: var(--ui-border-default);
}

.balance-hero-label {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 500;
  letter-spacing: 2rpx;
}

.balance-hero-amount {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
}

.balance-hero-symbol {
  color: var(--ui-color-text);
  font-size: 34rpx;
  font-weight: 600;
}

.balance-hero-value {
  color: var(--ui-color-text);

  font-size: 48rpx;
  line-height: 1.1;
  font-weight: var(--ui-font-weight-heading);
}

.balance-hero-copy {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 400;
}

.recharge-amount {
  margin-top: 22rpx;
}

.recharge-input {
  height: 88rpx;
  padding: 0 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-page);
  color: var(--ui-color-text);
  font-size: 30rpx;
  font-weight: 500;
  box-sizing: border-box;
}

.recharge-error {
  display: block;
  margin-top: 10rpx;
  color: var(--ui-color-danger);
  font-size: 22rpx;
  font-weight: 400;
}

.recharge-total {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin: 22rpx 4rpx;
}

.recharge-total-label {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 500;
}

.recharge-total-value {
  color: var(--ui-color-text);
  font-size: 44rpx;
  font-weight: var(--ui-font-weight-heading);
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

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.team-fund-page { padding: 0 var(--ui-page-padding-inline) var(--ui-page-padding-bottom); }
.team-fund-content { gap: var(--ui-section-gap); }

.state-text { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-medium); }
.balance-hero { gap: var(--ui-space-1); padding: 0 0 var(--ui-space-6); margin-bottom: var(--ui-section-gap); border-bottom: var(--ui-list-divider); }
.balance-hero-label { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-medium); letter-spacing: var(--ui-space-1); }
.balance-hero-amount { gap: var(--ui-space-1); }
.balance-hero-symbol { font-size: var(--ui-text-heading); font-weight: var(--ui-font-weight-heading); }
.balance-hero-value { font-size: var(--ui-text-stat); line-height: var(--ui-line-height-tight); }
.balance-hero-copy { font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-body); }
.recharge-amount { margin-top: var(--ui-space-5); }
.recharge-input { padding: 0 var(--ui-input-padding); font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-medium); width: 100%; height: var(--ui-input-height); border: var(--ui-input-border); border-radius: var(--ui-input-radius); background: var(--ui-color-surface); }
.recharge-error { margin-top: var(--ui-space-2); font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-body); }
.recharge-total { gap: var(--ui-space-3); margin: var(--ui-space-5) var(--ui-space-1); }
.recharge-total-label { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-medium); }
.recharge-total-value { font-size: var(--ui-text-stat); }
/* #endif */
</style>
