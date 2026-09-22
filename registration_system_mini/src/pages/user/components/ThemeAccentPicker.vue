<script setup lang="ts">
import { ref } from "vue";
import { ACCENT_THEMES, type AccentThemeId } from "@/config/themePalettes";
import { useAccentTheme } from "@/stores/theme";

// 主题偏好是设备本地设置，未登录也应可选；色卡用字面量色值展示各自主题。
const { accentTheme, setAccentTheme } = useAccentTheme();

const expanded = ref(false);
const options = Object.values(ACCENT_THEMES);

function handleSelect(id: AccentThemeId) {
  if (id === accentTheme.value) return;
  setAccentTheme(id);
  uni.showToast({ title: `已切换为${ACCENT_THEMES[id].label}`, icon: "none" });
}
</script>

<template>
  <view class="theme-picker">
    <view class="theme-picker__head" role="button" :aria-expanded="expanded" @tap="expanded = !expanded">
      <text class="theme-picker__title">主题色</text>
      <view class="theme-picker__current"><view class="theme-picker__dot" :style="{ background: ACCENT_THEMES[accentTheme].accent }" /><text class="theme-picker__caption">{{ ACCENT_THEMES[accentTheme].label }}</text><wd-icon :name="expanded ? 'arrow-up' : 'arrow-down'" size="24rpx" color="var(--ui-color-text-muted)" /></view>
    </view>
    <view class="theme-picker__reveal" :class="{ 'theme-picker__reveal--open': expanded }"><view class="theme-picker__clip">
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
        <view class="theme-picker__swatch" :style="{ background: option.accent, color: option.accentFg }">
          <text v-if="option.id === accentTheme" class="theme-picker__check">✓</text>
        </view>
        <text class="theme-picker__label">{{ option.label }}</text>
      </view>
    </view>
    </view></view>
  </view>
</template>

<style scoped>
.theme-picker {
  margin-top: 26rpx;
  padding: 28rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);

  box-sizing: border-box;
}

.theme-picker__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.theme-picker__title {
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.theme-picker__caption {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 400;
}

.theme-picker__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 20rpx;
}

.theme-picker__option {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 12rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.theme-picker__option--active {
  border: 2rpx solid var(--ui-color-accent);
  box-shadow: var(--ui-shadow-pressed);
}

.theme-picker__option--pressed {
  opacity: 0.72;
}

.theme-picker__swatch {
  flex-shrink: 0;
  width: 52rpx;
  height: 52rpx;
  border: 2rpx solid var(--ui-color-text);
  border-radius: var(--ui-radius-round);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.theme-picker__check {
  color: inherit;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1;
}

.theme-picker__label {
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 500;
}
.theme-picker__current { display:flex; align-items:center; gap:10rpx; }
.theme-picker__dot { width:20rpx; height:20rpx; border-radius:50%; }
.theme-picker__reveal { display:grid; grid-template-rows:0fr; opacity:0; pointer-events:none; transition:grid-template-rows var(--ui-motion-expand-duration) ease, opacity var(--ui-motion-expand-duration) ease; }
.theme-picker__reveal--open { grid-template-rows:1fr; opacity:1; pointer-events:auto; }
.theme-picker__clip { overflow:hidden; min-height:0; }
@media(prefers-reduced-motion:reduce) { .theme-picker__reveal { transition:none; } }
</style>
