<script setup lang="ts">
import { computed, ref } from "vue";
import { getCustomNavMetrics } from "@/utils/customNav";
import FloatingLoginPrompt from "@/components/FloatingLoginPrompt.vue";
// #ifdef H5
import H5TestLoginPanel from "@/components/H5TestLoginPanel.vue";
// #endif

const props = withDefaults(
  defineProps<{
    title: string;
    showBack?: boolean;
    plain?: boolean;
  }>(),
  {
    showBack: false,
    plain: false,
  },
);

const navMetrics = getCustomNavMetrics();

const shellStyle = computed(() => ({
  paddingTop: `${navMetrics.headerTop}px`,
}));

const contentStyle = computed(() => ({
  minHeight: `${navMetrics.headerMinHeight}px`,
  paddingRight: `${navMetrics.capsuleReserveRight}px`,
}));

// 左侧胶囊与右上角微信原生胶囊同高，形成左右对称的形态。
const capsuleStyle = computed(() => ({
  height: `${navMetrics.headerMinHeight}px`,
}));

const DOUBLE_TAP_SCROLL_INTERVAL_MS = 300;
let lastHeaderTapAt = 0;

/** 双击头部任意空白区域平滑回到页面顶部（胶囊内返回/回首页已 stop，不参与判定）。 */
function handleHeaderTap() {
  const now = Date.now();
  if (now - lastHeaderTapAt <= DOUBLE_TAP_SCROLL_INTERVAL_MS) {
    lastHeaderTapAt = 0;
    uni.pageScrollTo({ scrollTop: 0, duration: 300 });
    return;
  }
  lastHeaderTapAt = now;
}

function handleBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
    return;
  }

  uni.switchTab({
    url: "/pages/home/index",
  });
}

function isCurrentPageHome() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  return current?.route === "pages/home/index";
}

// 首页自身不显示回首页入口；页面创建时判定一次即可（switchTab 会重建页面）。
const showHomeEntry = ref(!isCurrentPageHome());

function handleHome() {
  uni.switchTab({
    url: "/pages/home/index",
  });
}

</script>

<template>
  <view :class="['app-tab-header-shell', props.plain ? 'app-tab-header-shell-plain' : '']" :style="shellStyle">
    <view class="app-tab-header" :style="contentStyle" @tap="handleHeaderTap">
      <view class="app-tab-header-left">
        <view
          v-if="props.showBack || showHomeEntry"
          class="app-tab-header-capsule"
          :style="capsuleStyle"
        >
          <view
            v-if="props.showBack"
            class="app-tab-header-capsule-side"
            hover-class="app-tab-header-capsule-side--pressed"
            :hover-stay-time="100"
            @tap.stop="handleBack"
          >
            <text class="app-tab-header-back-icon">‹</text>
          </view>
          <view v-if="props.showBack && showHomeEntry" class="app-tab-header-capsule-divider" />
          <view
            v-if="showHomeEntry"
            class="app-tab-header-capsule-side"
            hover-class="app-tab-header-capsule-side--pressed"
            :hover-stay-time="100"
            @tap.stop="handleHome"
          >
            <view class="app-tab-header-home-icon">
              <view class="app-tab-header-home-roof" />
              <view class="app-tab-header-home-body" />
            </view>
          </view>
        </view>
        <text class="app-tab-header-title">{{ props.title }}</text>
      </view>
    </view>
  </view>

  <FloatingLoginPrompt />

  <!-- #ifdef H5 -->
  <H5TestLoginPanel />
  <!-- #endif -->
</template>

<style scoped>
.app-tab-header-shell {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  padding-left: 28rpx;
  padding-right: 28rpx;
  padding-bottom: 14rpx;
  /* Neo 风格：实色画布底 + 墨线描边，不用毛玻璃。 */
  background: var(--neo-color-page);
  border-bottom: var(--neo-border-default);
  box-sizing: border-box;
}

.app-tab-header-shell-plain {
  background: transparent;
  border-bottom: none;
}

.app-tab-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
}

.app-tab-header-left {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
}

/* 对齐右上角微信原生胶囊：半透明白底、细描边、圆角胶囊、中间细分隔线。 */
.app-tab-header-capsule {
  display: inline-flex;
  align-items: stretch;
  border-radius: var(--neo-radius-round);
  border: 2rpx solid rgba(var(--neo-primitive-ink-rgb), 0.08);
  background: rgba(var(--neo-primitive-surface-rgb), 0.72);
  overflow: hidden;
  flex-shrink: 0;
}

.app-tab-header-capsule-side {
  width: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-tab-header-capsule-side--pressed {
  background: rgba(var(--neo-primitive-ink-rgb), 0.06);
}

.app-tab-header-capsule-divider {
  width: 2rpx;
  margin: 10rpx 0;
  background: rgba(var(--neo-primitive-ink-rgb), 0.12);
  flex-shrink: 0;
}

.app-tab-header-back-icon {
  color: var(--neo-color-text);
  font-size: 46rpx;
  line-height: 1;
  font-weight: 900;
  transform: translateY(-2rpx);
}

.app-tab-header-home-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2rpx;
}

.app-tab-header-home-roof {
  width: 0;
  height: 0;
  border-left: 13rpx solid transparent;
  border-right: 13rpx solid transparent;
  border-bottom: 10rpx solid var(--neo-color-text);
}

.app-tab-header-home-body {
  width: 18rpx;
  height: 11rpx;
  margin-top: 2rpx;
  background: var(--neo-color-text);
}

.app-tab-header-title {
  font-size: 36rpx;
  font-weight: 900;
  color: var(--neo-color-text);
  flex-shrink: 0;
}
</style>
