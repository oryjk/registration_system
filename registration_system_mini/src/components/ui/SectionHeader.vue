<script setup lang="ts">
import AppButton from "./AppButton.vue";

defineProps<{
  title: string;
  caption?: string;
  marker?: string;
  actionLabel?: string;
}>();

const emit = defineEmits<{
  (event: "action"): void;
}>();
</script>

<template>
  <view class="ui-section-header">
    <view class="ui-section-header__copy">
      <view class="ui-section-header__title-row">
        <text v-if="marker" class="ui-section-header__marker">{{ marker }}</text>
        <text class="ui-section-header__title">{{ title }}</text>
      </view>
      <text v-if="caption" class="ui-section-header__caption">{{ caption }}</text>
    </view>
    <AppButton
      v-if="actionLabel"
      variant="outline"
      size="sm"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </AppButton>
  </view>
</template>

<style scoped>
.ui-section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 30rpx;
}

.ui-section-header__copy {
  min-width: 0;
}

.ui-section-header__title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.ui-section-header__marker {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-accent-deep);
  font-size: 22rpx;
  font-weight: 600;
}

.ui-section-header__title {
  display: block;
  min-width: 0;
  color: var(--ui-color-text);
  font-size: 34rpx;
  line-height: 1.2;
  font-weight: 600;
}

.ui-section-header__caption {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 1.55;
}

/* #ifdef MP-WEIXIN */
.ui-section-header { gap: var(--ui-space-4); margin-top: var(--ui-space-6); }
.ui-section-header__title-row { gap: var(--ui-space-3); }
.ui-section-header__title { font-size: var(--ui-text-heading); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); }
.ui-section-header__caption { margin-top: var(--ui-space-2); color: var(--ui-color-text-secondary); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.ui-section-header__marker { width: var(--ui-icon-lg); height: var(--ui-icon-lg); background: var(--ui-control-subtle-bg); font-size: var(--ui-text-sm); }
/* #endif */
</style>
