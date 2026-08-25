<script setup lang="ts">
import { ACCENT_THEMES, type AccentThemeId } from "@/config/themePalettes";
import { useAccentTheme } from "@/stores/theme";

// 主题偏好是设备本地设置，未登录也应可选；色卡用字面量色值展示各自主题。
const { accentTheme, setAccentTheme } = useAccentTheme();

const options = Object.values(ACCENT_THEMES);

function handleSelect(id: AccentThemeId) {
  if (id === accentTheme.value) return;
  setAccentTheme(id);
  uni.showToast({ title: `已切换为${ACCENT_THEMES[id].label}`, icon: "none" });
}
</script>

<template>
  <view class="theme-picker">
    <view class="theme-picker__head">
      <text class="theme-picker__title">主题色</text>
      <text class="theme-picker__caption">选择强调色，立即生效</text>
    </view>
    <view class="theme-picker__options">
      <view
        v-for="option in options"
        :key="option.id"
        class="theme-picker__option"
        :class="{ 'theme-picker__option--active': option.id === accentTheme }"
        hover-class="theme-picker__option--pressed"
        :hover-stay-time="100"
        @tap="handleSelect(option.id)"
      >
        <view class="theme-picker__swatch" :style="{ background: option.accent }">
          <text v-if="option.id === accentTheme" class="theme-picker__check">✓</text>
        </view>
        <text class="theme-picker__label">{{ option.label }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.theme-picker {
  margin-top: 26rpx;
  padding: 22rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: var(--neo-shadow-raised);
  box-sizing: border-box;
}

.theme-picker__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18rpx;
}

.theme-picker__title {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

.theme-picker__caption {
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
}

.theme-picker__options {
  display: flex;
  gap: 18rpx;
  margin-top: 20rpx;
}

.theme-picker__option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 12rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.theme-picker__option--active {
  border: var(--neo-border-strong);
  box-shadow: var(--neo-shadow-pressed);
}

.theme-picker__option--pressed {
  opacity: 0.72;
}

.theme-picker__swatch {
  width: 64rpx;
  height: 64rpx;
  border: 2rpx solid var(--neo-color-text);
  border-radius: var(--neo-radius-round);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.theme-picker__check {
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1;
}

.theme-picker__label {
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 800;
}
</style>
