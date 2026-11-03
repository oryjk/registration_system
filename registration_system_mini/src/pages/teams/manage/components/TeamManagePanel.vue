<script setup lang="ts">
import AppSurface from '@/components/ui/AppSurface.vue';
defineProps<{ title: string; caption?: string }>();
</script>

<template>
  <AppSurface variant="outlined" flush>
    <view class="manage-panel ui-plain-panel">
      <view class="manage-panel-heading">
        <view class="manage-panel-copy">
          <text class="manage-panel-title">{{ title }}</text>
          <text v-if="caption" class="manage-panel-caption">{{ caption }}</text>
        </view>
        <slot name="accessory" />
      </view>
      <slot />
    </view>
  </AppSurface>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
.manage-panel { padding: 26rpx 28rpx; }
.manage-panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-bottom: 24rpx; }
.manage-panel-copy { flex: 1; min-width: 0; }
.manage-panel-title { display: block; font-size: 34rpx; font-weight: 600; line-height: 1.35; color: var(--ui-color-text); overflow-wrap: anywhere; }
.manage-panel-caption { display: block; margin-top: 8rpx; font-size: 22rpx; line-height: 1.6; color: var(--ui-color-text-muted); }

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.manage-panel { padding: var(--ui-card-padding); }
.manage-panel-heading { gap: var(--ui-list-row-gap); margin-bottom: var(--ui-space-6); }
.manage-panel-title { font-size: var(--ui-text-heading); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); }
.manage-panel-caption { margin-top: var(--ui-space-2); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-body); }
/* #endif */

/* #ifdef MP-WEIXIN */
.manage-panel-caption { color: var(--ui-color-text-secondary); }
.manage-panel-heading { align-items: flex-start; }
.manage-panel-title { font-size: var(--ui-text-title); }
/* #endif */
</style>
