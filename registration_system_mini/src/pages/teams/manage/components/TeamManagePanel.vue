<script setup lang="ts">
import AppSurface from '@/components/ui/AppSurface.vue';
defineProps<{ title: string; caption?: string }>();
</script>

<template>
  <AppSurface variant="outlined" flush>
    <view class="manage-panel">
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
.manage-panel { padding: 26rpx 28rpx; }
.manage-panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-bottom: 24rpx; }
.manage-panel-copy { flex: 1; min-width: 0; }
.manage-panel-title { display: block; font-size: 34rpx; font-weight: 600; line-height: 1.35; color: var(--ui-color-text); overflow-wrap: anywhere; }
.manage-panel-caption { display: block; margin-top: 8rpx; font-size: 22rpx; line-height: 1.6; color: var(--ui-color-text-muted); }
</style>
