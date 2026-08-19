<script setup lang="ts">
import { computed, ref } from "vue";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useCurrentLocation } from "@/stores/currentLocation";
import { isOpenLocationSupported } from "@/utils/location";
import { getAppPlatform } from "@/utils/systemInfo";
import FloatingLoginPrompt from "@/components/FloatingLoginPrompt.vue";
// #ifdef H5
import H5TestLoginPanel from "@/components/H5TestLoginPanel.vue";
// #endif

const props = withDefaults(
  defineProps<{
    title: string;
    showBack?: boolean;
    showLocation?: boolean;
    plain?: boolean;
  }>(),
  {
    showBack: false,
    showLocation: false,
    plain: false,
  },
);

const navMetrics = getCustomNavMetrics();
const showLocationSheet = ref(false);
const canOpenLocation = isOpenLocationSupported(getAppPlatform());
const {
  currentLocation,
  isLocationLoading,
  locationLabel,
  locationAddress,
  locationMarkers,
  ensureCurrentLocation,
  refreshCurrentLocation,
} = useCurrentLocation();

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

/** 双击头部任意空白区域平滑回到页面顶部（返回/定位入口已 stop，不参与判定）。 */
function handleHeaderTap() {
  const now = Date.now();
  if (now - lastHeaderTapAt <= DOUBLE_TAP_SCROLL_INTERVAL_MS) {
    lastHeaderTapAt = 0;
    uni.pageScrollTo({ scrollTop: 0, duration: 300 });
    return;
  }
  lastHeaderTapAt = now;
}

async function handleLocationTap() {
  try {
    await ensureCurrentLocation();
    if (currentLocation.value) {
      showLocationSheet.value = true;
    }
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "定位失败",
      icon: "none",
    });
  }
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

function closeLocationSheet() {
  showLocationSheet.value = false;
}

function handleOpenLocation() {
  if (!currentLocation.value) {
    return;
  }

  if (!canOpenLocation) {
    uni.showToast({
      title: "开发者工具不支持腾讯地图周边/导航，请真机测试",
      icon: "none",
      duration: 2800,
    });
    return;
  }

  uni.openLocation({
    latitude: currentLocation.value.latitude,
    longitude: currentLocation.value.longitude,
    scale: 16,
    name: currentLocation.value.label,
    address: currentLocation.value.address || currentLocation.value.label,
  });
}

async function handleRefreshLocation() {
  try {
    await refreshCurrentLocation();
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "定位失败",
      icon: "none",
    });
  }
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
        <view v-if="props.showLocation" class="app-tab-header-location" @tap.stop="handleLocationTap">
          <text class="app-tab-header-location-dot">●</text>
          <text class="app-tab-header-location-text">{{ locationLabel }}</text>
          <text class="app-tab-header-location-arrow">▾</text>
        </view>
      </view>
    </view>
  </view>

  <FloatingLoginPrompt />

  <!-- #ifdef H5 -->
  <H5TestLoginPanel />
  <!-- #endif -->

  <view v-if="showLocationSheet" class="location-sheet-mask" @tap="closeLocationSheet">
    <view class="location-sheet" @tap.stop>
      <view class="location-sheet-head">
        <view>
          <text class="location-sheet-title">{{ currentLocation?.label || "当前位置" }}</text>
          <text class="location-sheet-copy">{{ locationAddress }}</text>
        </view>
        <view class="location-sheet-close" @tap="closeLocationSheet">×</view>
      </view>

      <map
        v-if="currentLocation"
        class="location-sheet-map"
        :latitude="currentLocation.latitude"
        :longitude="currentLocation.longitude"
        :markers="locationMarkers"
        :show-location="true"
        :scale="15"
      />

      <view class="location-sheet-actions">
        <view class="location-sheet-secondary" @tap="handleRefreshLocation">
          {{ isLocationLoading ? "定位中..." : "重新定位" }}
        </view>
        <view class="location-sheet-primary" @tap="handleOpenLocation">
          {{ canOpenLocation ? "打开地图" : "真机测试" }}
        </view>
      </view>
    </view>
  </view>
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

.app-tab-header-location {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
  padding: 8rpx 0;
}

.app-tab-header-location-dot {
  color: var(--neo-color-text);
  font-size: 18rpx;
}

.app-tab-header-location-text {
  font-size: 24rpx;
  color: var(--neo-color-text-muted);
  font-weight: 700;
}

.app-tab-header-location-arrow {
  color: var(--neo-color-text-disabled);
  font-size: 18rpx;
  font-weight: 800;
}

.location-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--neo-color-overlay);
  padding: 28rpx;
  box-sizing: border-box;
}

.location-sheet {
  width: 100%;
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  padding: 28rpx;
  box-sizing: border-box;
  box-shadow: var(--neo-shadow-modal);
}

.location-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.location-sheet-title {
  display: block;
  font-size: 34rpx;
  color: var(--neo-color-text);
  font-weight: 900;
}

.location-sheet-copy {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: var(--neo-color-text-muted);
}

.location-sheet-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: var(--neo-radius-round);
  background: var(--neo-color-muted);
  color: var(--neo-color-text);
  font-size: 38rpx;
  line-height: 56rpx;
  text-align: center;
  flex-shrink: 0;
}

.location-sheet-map {
  width: 100%;
  height: 420rpx;
  margin-top: 24rpx;
  border-radius: var(--neo-radius-md);
  overflow: hidden;
}

.location-sheet-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.location-sheet-secondary,
.location-sheet-primary {
  flex: 1;
  height: 84rpx;
  border-radius: var(--neo-radius-round);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 900;
}

.location-sheet-secondary {
  background: var(--neo-color-muted);
  color: var(--neo-color-text);
}

.location-sheet-primary {
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
}
</style>
