<script setup lang="ts">
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";

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
</script>

<template>
  <view class="mine-wallet-section">
    <NeoSectionHeader title="钱包与账单" marker="¥" caption="报名费用和球队账单统一查看" />
    <NeoSurface custom-class="mine-wallet-strip">
      <view class="mine-wallet-strip__copy">
        <text class="mine-wallet-strip__label">钱包余额</text>
        <text class="mine-wallet-strip__value">{{ walletSummary.balanceLabel }}</text>
        <text class="mine-wallet-strip__meta">累计支出 {{ walletSummary.totalExpenseLabel }} · {{ walletSummary.latestExpenseLabel }}</text>
      </view>
      <NeoButton variant="dark" size="sm" @click="emit('openBilling')">查看账单</NeoButton>
    </NeoSurface>
  </view>
</template>

<style scoped>
.mine-wallet-section {
  margin-top: 34rpx;
}

.mine-wallet-strip {
  display: flex;
  min-height: 156rpx;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 18rpx;
  background: var(--neo-color-warning-soft);
}

.mine-wallet-strip__copy {
  min-width: 0;
  flex: 1;
}

.mine-wallet-strip__label,
.mine-wallet-strip__value,
.mine-wallet-strip__meta {
  display: block;
}

.mine-wallet-strip__label {
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 900;
}

.mine-wallet-strip__value {
  margin-top: 4rpx;
  color: var(--neo-color-text);
  font-size: 44rpx;
  font-weight: 900;
  line-height: 1.12;
  word-break: break-word;
}

.mine-wallet-strip__meta {
  margin-top: 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.4;
}
</style>
