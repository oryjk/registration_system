<script setup lang="ts">
import NeoButton from "./NeoButton.vue";

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
  <view class="neo-section-header">
    <view class="neo-section-header__copy">
      <view class="neo-section-header__title-row">
        <text v-if="marker" class="neo-section-header__marker">{{ marker }}</text>
        <text class="neo-section-header__title">{{ title }}</text>
      </view>
      <text v-if="caption" class="neo-section-header__caption">{{ caption }}</text>
    </view>
    <NeoButton
      v-if="actionLabel"
      variant="outline"
      size="sm"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </NeoButton>
  </view>
</template>

<style scoped>
.neo-section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 30rpx;
}

.neo-section-header__copy {
  min-width: 0;
}

.neo-section-header__title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.neo-section-header__marker {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 22rpx;
  font-weight: 800;
}

.neo-section-header__title {
  display: block;
  min-width: 0;
  color: var(--neo-color-text);
  font-size: 38rpx;
  line-height: 1.15;
  font-weight: 900;
}

.neo-section-header__caption {
  display: block;
  margin-top: 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  line-height: 1.55;
}
</style>
