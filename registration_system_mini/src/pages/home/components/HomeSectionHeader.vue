<script setup lang="ts">
defineProps<{ title: string; actionLabel?: string }>();
const emit = defineEmits<{ (event: 'action'): void }>();
</script>

<template>
  <view class="home-section-header">
    <view class="home-section-header__heading">
      <text class="home-section-header__title">{{ title }}</text>
      <slot name="meta" />
    </view>
    <view class="home-section-header__actions">
      <slot name="actions">
        <button v-if="actionLabel" class="home-section-header__more" @tap="emit('action')">
          <text>{{ actionLabel }}</text><wd-icon name="arrow-right" size="24rpx" />
        </button>
      </slot>
    </view>
  </view>
</template>

<style scoped>
.home-section-header { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; min-height: 64rpx; margin: 24rpx 0 12rpx; }
.home-section-header__heading { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.home-section-header__title { color: var(--ui-color-text); font-size: 32rpx; font-weight: 600; line-height: 44rpx; }
.home-section-header__actions { flex-shrink: 0; }
.home-section-header__more { display: flex; align-items: center; gap: 4rpx; min-height: 64rpx; margin: 0; padding: 0 0 0 16rpx; background: transparent; color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 1; border: none; }
.home-section-header__more::after { border: none; }
</style>
