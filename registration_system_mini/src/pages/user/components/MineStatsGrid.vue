<script setup lang="ts">
import type { MineStatItem } from "../mineTypes";

defineProps<{
  items: MineStatItem[];
}>();
</script>

<template>
  <view class="mine-stats-grid ui-card-panel">
    <view v-for="item in items" :key="item.key" class="mine-stat">
      <view class="mine-stat__value-row"><text class="mine-stat__value">{{ item.value }}</text><text v-if="item.unit" class="mine-stat__unit">{{ item.unit }}</text></view>
      <text class="mine-stat__label">{{ item.label }}</text>
    </view>
  </view>
</template>
<style scoped>
@import "@/styles/list-surfaces.css";

.mine-stats-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); margin-top:20rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-card); background:var(--ui-color-surface); padding:8rpx 24rpx; }
.mine-stat { padding:22rpx 12rpx; min-width:0; }
.mine-stat:nth-child(n+3) { border-top:var(--ui-border-default); }
.mine-stat__value-row { display:flex; align-items:baseline; gap:6rpx; }
.mine-stat__value { color:var(--ui-color-text); font-size:34rpx; font-weight:600; overflow-wrap:anywhere; }
.mine-stat__unit,.mine-stat__label { color:var(--ui-color-text-muted); font-size:22rpx; }
.mine-stat__label { display:block; margin-top:6rpx; }


/* #ifdef MP-WEIXIN */
.mine-stats-grid { margin-top: var(--ui-card-gap); padding: var(--ui-space-2) var(--ui-card-padding); border: var(--ui-panel-border); border-radius: var(--ui-card-radius); background: var(--ui-card-bg); }
.mine-stat { padding: var(--ui-space-5) var(--ui-space-3); }
.mine-stat:nth-child(n+3) { border-top: var(--ui-list-divider); }
.mine-stat__value { font-size: var(--ui-text-heading); font-weight: var(--ui-font-weight-heading); }
.mine-stat__unit,.mine-stat__label { font-size: var(--ui-text-sm); }
/* #endif */
</style>
