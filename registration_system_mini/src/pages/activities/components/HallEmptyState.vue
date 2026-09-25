<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";

defineProps<{
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel?: string;
}>();

const emit = defineEmits<{
  (event: "primary"): void;
  (event: "secondary"): void;
}>();
</script>

<template>
  <AppSurface variant="outlined" flush>
    <view class="hall-empty-state">
      <view class="hall-empty-state__copy">
        <view class="hall-empty-state__ball" aria-hidden="true" />
        <view class="hall-empty-state__text">
          <text class="hall-empty-state__title">{{ title }}</text>
          <text class="hall-empty-state__description">{{ description }}</text>
        </view>
      </view>

      <view class="hall-empty-state__actions">
        <AppButton block variant="lime" @click="emit('primary')">{{ primaryLabel }}</AppButton>
        <button
          v-if="secondaryLabel"
          class="hall-empty-state__secondary"
          hover-class="hall-empty-state__secondary--pressed"
          @tap="emit('secondary')"
        >
          {{ secondaryLabel }}
          <text aria-hidden="true">→</text>
        </button>
      </view>
    </view>
  </AppSurface>
</template>

<style scoped>
.hall-empty-state {
  padding: 30rpx 28rpx 26rpx;
}

.hall-empty-state__copy {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.hall-empty-state__ball {
  flex: 0 0 52rpx;
  width: 52rpx;
  height: 52rpx;
  margin-top: 2rpx;
  border: 4rpx solid var(--ui-color-text);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent-soft);
  box-sizing: border-box;
}

.hall-empty-state__text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}

.hall-empty-state__title {
  color: var(--ui-color-text);
  font-size: 32rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.35;
}

.hall-empty-state__description {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 1.6;
}

.hall-empty-state__actions {
  margin-top: 26rpx;
}

.hall-empty-state__secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  width: 100%;
  min-height: 68rpx;
  margin: 10rpx 0 0;
  padding: 8rpx 16rpx;
  border: 0;
  background: transparent;
  color: var(--ui-color-text-muted);
  font-size: 23rpx;
  line-height: 1.4;
}

.hall-empty-state__secondary::after {
  border: 0;
}

.hall-empty-state__secondary--pressed {
  opacity: 0.65;
}
</style>
