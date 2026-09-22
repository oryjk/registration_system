<script setup lang="ts">
import SectionHeader from "@/components/ui/SectionHeader.vue";
import AppSurface from "@/components/ui/AppSurface.vue";

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
    <SectionHeader title="钱包与账单" />
    <!-- mp-weixin 陷阱：custom-class + 父级 scoped 给子组件根节点做布局会被样式隔离挡住。
         AppSurface flush 后横排布局放在自己模板的包裹 view 上。 -->
    <AppSurface flush class="mine-wallet-surface">
      <view class="mine-wallet-strip">
        <view class="mine-wallet-strip__copy">
          <text class="mine-wallet-strip__label">钱包余额</text>
          <text class="mine-wallet-strip__value">{{ walletSummary.balanceLabel }}</text>
          <text class="mine-wallet-strip__meta">累计支出 {{ walletSummary.totalExpenseLabel }} · {{ walletSummary.latestExpenseLabel }}</text>
        </view>
        <button class="wallet-action" @tap="emit('openBilling')"><text>账单</text><wd-icon name="arrow-right" size="24rpx" /></button>
      </view>
    </AppSurface>
  </view>
</template>

<style scoped>
.mine-wallet-section {
  margin-top: 28rpx;
}

.mine-wallet-surface {
  margin-top: 18rpx;
}

.mine-wallet-strip {
  display: flex;
  min-height: 128rpx;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx 24rpx;
  background: var(--ui-color-surface);
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
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 600;
}

.mine-wallet-strip__value {
  margin-top: 4rpx;
  color: var(--ui-color-text);
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1.12;
  word-break: break-word;
}

.mine-wallet-strip__meta {
  margin-top: 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 20rpx;
  font-weight: 400;
  line-height: 1.4;
}
.wallet-action { display:flex; align-items:center; gap:6rpx; flex-shrink:0; margin:0; padding:14rpx 0 14rpx 12rpx; border:0; background:transparent; color:var(--ui-color-accent-deep); font-size:24rpx; line-height:1.4; }
.wallet-action::after { border:0; }
</style>
