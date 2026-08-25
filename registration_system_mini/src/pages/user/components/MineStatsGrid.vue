<script setup lang="ts">
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { MineStatItem } from "../mineTypes";

defineProps<{
  items: MineStatItem[];
}>();
</script>

<template>
  <view class="mine-stats-grid">
    <NeoSurface
      v-for="item in items"
      :key="item.key"
      :custom-class="`mine-stat mine-stat--${item.tone}`"
    >
      <view class="mine-stat__value-row">
        <text class="mine-stat__value">{{ item.value }}</text>
        <text v-if="item.unit" class="mine-stat__unit">{{ item.unit }}</text>
      </view>
      <text class="mine-stat__label">{{ item.label }}</text>
    </NeoSurface>
  </view>
</template>

<style scoped>
.mine-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 22rpx;
}

.mine-stat {
  display: flex;
  min-height: 142rpx;
  padding: 20rpx;
  flex-direction: column;
  justify-content: space-between;
}

/* 主指标卡用强调色底突出焦点，其余统计卡保持白底标准形态。 */
.mine-stat--accent {
  background: var(--neo-color-accent);
}

.mine-stat--accent .mine-stat__label {
  color: var(--neo-color-text);
}

.mine-stat__value-row {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 6rpx;
  flex-wrap: wrap;
}

.mine-stat__value {
  min-width: 0;
  color: var(--neo-color-text);
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.05;
  word-break: break-word;
}

.mine-stat__unit {
  color: var(--neo-color-text);
  font-size: 22rpx;
  font-weight: 900;
}

.mine-stat__label {
  display: block;
  margin-top: 14rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.35;
}
</style>
