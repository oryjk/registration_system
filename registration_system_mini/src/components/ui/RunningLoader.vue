<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
const { themePageStyle } = useAccentTheme();
withDefaults(defineProps<{ text?: string; compact?: boolean }>(), { text: "正在进入球场", compact: false });
</script>

<template>
  <view :class="['app-theme-scope', 'ui-runner', compact ? 'ui-runner--compact' : '']" :style="themePageStyle" role="status" aria-live="polite" aria-busy="true">
    <view class="ui-runner__scene" aria-hidden="true">
      <view class="ui-runner__track" />
      <view class="ui-runner__orbit" />
      <view class="ui-runner__ball">
        <view class="ui-runner__patch ui-runner__patch--center" />
        <view class="ui-runner__patch ui-runner__patch--top" />
        <view class="ui-runner__patch ui-runner__patch--right" />
        <view class="ui-runner__patch ui-runner__patch--bottom" />
        <view class="ui-runner__patch ui-runner__patch--left" />
      </view>
    </view>
    <text class="ui-runner__text">{{ text }}</text>
  </view>
</template>

<style scoped>
.ui-runner { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28rpx; min-height: 320rpx; padding: 48rpx 24rpx; box-sizing: border-box; background: transparent; }
.ui-runner__scene { position: relative; display: flex; align-items: center; justify-content: center; width: 112rpx; height: 112rpx; }
.ui-runner__track, .ui-runner__orbit { position: absolute; inset: 0; border: 3rpx solid var(--ui-color-line); border-radius: 50%; box-sizing: border-box; }
.ui-runner__orbit { border-color: var(--ui-color-accent) transparent transparent; animation: loader-orbit 1.2s linear infinite; }
.ui-runner__ball { position: relative; width: 58rpx; height: 58rpx; overflow: hidden; border: 2rpx solid var(--ui-color-text); border-radius: 50%; background: var(--ui-color-surface); box-sizing: border-box; }
.ui-runner__patch { position: absolute; width: 20rpx; height: 20rpx; border-radius: 5rpx; background: var(--ui-color-text); transform: rotate(45deg); }
.ui-runner__patch--center { top: 17rpx; left: 17rpx; width: 19rpx; height: 19rpx; }
.ui-runner__patch--top { top: -12rpx; left: 17rpx; }
.ui-runner__patch--right { top: 17rpx; right: -12rpx; }
.ui-runner__patch--bottom { bottom: -12rpx; left: 17rpx; }
.ui-runner__patch--left { top: 17rpx; left: -12rpx; }
.ui-runner__text { color: var(--ui-color-text-muted); font-size: 24rpx; font-weight: 400; line-height: 1.5; text-align: center; }
.ui-runner--compact { display: inline-flex; flex-direction: row; gap: 12rpx; width: auto; max-width: 100%; min-height: 0; padding: 12rpx 20rpx; border: var(--ui-border-default); border-radius: var(--ui-radius-round); background: var(--ui-color-surface); box-shadow: var(--ui-shadow-soft); }
.ui-runner--compact .ui-runner__scene { width: 48rpx; height: 48rpx; flex-shrink: 0; }
.ui-runner--compact .ui-runner__track, .ui-runner--compact .ui-runner__orbit { border-width: 2rpx; }
.ui-runner--compact .ui-runner__ball { width: 24rpx; height: 24rpx; }
.ui-runner--compact .ui-runner__patch { width: 8rpx; height: 8rpx; border-radius: 2rpx; }
.ui-runner--compact .ui-runner__patch--center { top: 6rpx; left: 6rpx; }
.ui-runner--compact .ui-runner__patch--top { top: -5rpx; left: 6rpx; }
.ui-runner--compact .ui-runner__patch--right { top: 6rpx; right: -5rpx; }
.ui-runner--compact .ui-runner__patch--bottom { bottom: -5rpx; left: 6rpx; }
.ui-runner--compact .ui-runner__patch--left { top: 6rpx; left: -5rpx; }
.ui-runner--compact .ui-runner__text { font-size: 23rpx; white-space: nowrap; }
@keyframes loader-orbit { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ui-runner__orbit { animation: none; } }
</style>
