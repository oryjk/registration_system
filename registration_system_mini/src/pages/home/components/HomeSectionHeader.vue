<script setup lang="ts">
defineProps<{ title: string; actionLabel?: string; first?: boolean }>();
const emit = defineEmits<{ (event: 'action'): void }>();
</script>

<template>
  <view class="home-section-header" :class="{ 'home-section-header--first': first }">
    <view class="home-section-header__heading">
      <text class="home-section-header__title">{{ title }}</text>
      <slot name="meta" />
    </view>
    <view class="home-section-header__actions">
      <slot name="actions">
        <button v-if="actionLabel" class="home-section-header__more ui-native-button" @tap="emit('action')">
          <text>{{ actionLabel }}</text>
          <!-- #ifdef MP-WEIXIN -->
          <image class="home-section-header__chevron" src="/static/home-icons/chevron-right.png" mode="aspectFit" aria-hidden="true" />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <wd-icon name="arrow-right" size="24rpx" />
          <!-- #endif -->
        </button>
      </slot>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/button-controls.css";
.home-section-header { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; min-height: 64rpx; margin: 24rpx 0 12rpx; }
.home-section-header__heading { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.home-section-header__title { color: var(--ui-color-text); font-size: 32rpx; font-weight: 600; line-height: 44rpx; }
.home-section-header__actions { flex-shrink: 0; }
.home-section-header__more { display: flex; align-items: center; gap: 4rpx; min-height: 64rpx; margin: 0; padding: 0 0 0 16rpx; background: transparent; color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 1; border: none; }
.home-section-header__more::after { border: none; }
/* #ifdef MP-WEIXIN */
.home-section-header { margin: var(--ui-home-section-gap) 0 var(--ui-space-4); min-height: var(--ui-control-min-height); }
.home-section-header--first { margin-top: var(--ui-space-1); margin-bottom: var(--ui-space-2); min-height: 0; }
.home-section-header__title { font-size: var(--ui-home-heading-size); line-height: var(--ui-line-height-tight); }
.home-section-header__more { gap: var(--ui-space-1); min-height: var(--ui-control-min-height); padding: 0; color: var(--ui-home-muted); font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-body); }
.home-section-header__chevron { width: var(--ui-icon-sm); height: var(--ui-icon-sm); }
/* #endif */
</style>
