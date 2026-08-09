<script setup lang="ts">
withDefaults(defineProps<{
  visible?: boolean;
}>(), {
  visible: true,
});
</script>

<template>
  <view v-if="visible" class="neo-sticky-action-bar">
    <view v-if="$slots.leading" class="neo-sticky-action-bar__leading">
      <slot name="leading" />
    </view>
    <view class="neo-sticky-action-bar__actions">
      <slot />
    </view>
  </view>
</template>

<style scoped>
.neo-sticky-action-bar {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + var(--neo-action-bar-bottom));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 16rpx;
  width: calc(100% - 48rpx);
  max-width: 702rpx;
  padding: var(--neo-action-bar-padding);
  border: var(--neo-border-strong);
  border-radius: var(--neo-action-bar-radius);
  background: var(--neo-action-bar-bg);
  box-shadow: var(--neo-action-bar-shadow);
  transform: translateX(-50%);
  box-sizing: border-box;
}

.neo-sticky-action-bar__leading {
  min-width: 0;
  flex: 1;
}

.neo-sticky-action-bar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
  min-width: 0;
  flex: 1;
}
</style>
