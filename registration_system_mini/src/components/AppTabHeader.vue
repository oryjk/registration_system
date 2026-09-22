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

// 保留原生胶囊的高度与安全区，内部使用独立导航按钮。
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
            role="button"
            aria-label="返回上一页"
            @tap.stop="handleBack"
          >
            <wd-icon name="arrow-left" size="36rpx" />
          </view>
          <view
            v-if="showHomeEntry"
            class="app-tab-header-capsule-side"
            hover-class="app-tab-header-capsule-side--pressed"
            :hover-stay-time="100"
            role="button"
            aria-label="回到首页"
            @tap.stop="handleHome"
          >
            <wd-icon name="home" size="34rpx" />
          </view>
        </view>
        <!-- 具名 title slot：允许页面替换标题区（如首页的球队切换器 + 搜索入口）；不传时回落到 title 文本。 -->
        <slot name="title">
          <text class="app-tab-header-title">{{ props.title }}</text>
        </slot>
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
  /* D 风格：实色画布底 + 浅色细描边，不用毛玻璃。 */
  background: var(--ui-color-page);
  border-bottom: 2rpx solid var(--ui-color-line);
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
  box-sizing: border-box;
}

.app-tab-header-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
}

.app-tab-header-capsule {
  display: inline-flex;
  align-items: stretch;
  gap: 8rpx;
  flex-shrink: 0;
}

.app-tab-header-capsule-side {
  width: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--ui-color-text);
  background: var(--ui-color-neutral-bg);
  border-radius: 18rpx;
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out), background-color var(--ui-motion-press-duration) ease;
}

.app-tab-header-capsule-side--pressed {
  background: var(--ui-color-accent-soft);
  transform: scale(0.92);
}

.app-tab-header-title {
  min-width: 0;
  flex: 1;
  font-size: 30rpx;
  line-height: 1.4;
  font-weight: 600;
  color: var(--ui-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (prefers-reduced-motion: reduce) {
  .app-tab-header-capsule-side { transition: none; }
  .app-tab-header-capsule-side--pressed { transform: none; }
}
</style>
