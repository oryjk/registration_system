<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif

// 场地选择入口：与输入框同规格的点击框，点击由页面打开 VenuePickerSheet。
defineProps<{
  location: string;
}>();

const emit = defineEmits<{
  (event: "open"): void;
}>();
</script>

<template>
  <view class="venue-entry" hover-class="venue-entry--pressed" @tap="emit('open')">
    <text :class="['venue-entry__value', location ? '' : 'venue-entry__placeholder']">
      {{ location || "点击选择球场/地址" }}
    </text>
    <view class="venue-entry__icon" aria-hidden="true">
      <!-- #ifdef MP-WEIXIN -->
      <AppIcon name="map-pin" size="var(--ui-icon-md)" tone="muted" />
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <wd-icon name="location" size="32rpx" color="var(--ui-color-text-muted)" />
      <!-- #endif -->
    </view>
  </view>
</template>

<style scoped>
.venue-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  width: 100%;
  min-height: 84rpx;
  padding: 0 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.venue-entry--pressed {
  background: var(--ui-color-surface);
}

.venue-entry__value {
  flex: 1;
  min-width: 0;
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.venue-entry__placeholder {
  color: var(--ui-color-text-disabled);
}

.venue-entry__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
}

/* #ifdef MP-WEIXIN */
.venue-entry { min-height: var(--ui-input-height); padding: var(--ui-space-3) var(--ui-input-padding); border: var(--ui-input-border); border-radius: var(--ui-input-radius); font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-body); }
.venue-entry__value { overflow: visible; white-space: normal; overflow-wrap: anywhere; font-size: var(--ui-text-label); line-height: var(--ui-line-height-compact); }
/* #endif */
</style>
