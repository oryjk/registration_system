<script setup lang="ts">
import { computed, ref } from "vue";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useCurrentLocation } from "@/stores/currentLocation";
import { isOpenLocationSupported } from "@/utils/location";
import { getAppPlatform } from "@/utils/systemInfo";
import FloatingLoginPrompt from "@/components/FloatingLoginPrompt.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    showBack?: boolean;
    showLocation?: boolean;
  }>(),
  {
    showBack: false,
    showLocation: false,
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
  <view class="app-tab-header-shell" :style="shellStyle">
    <view class="app-tab-header" :style="contentStyle">
      <view class="app-tab-header-left">
        <view v-if="props.showBack" class="app-tab-header-back" @tap="handleBack">
          <text class="app-tab-header-back-icon">‹</text>
        </view>
        <text class="app-tab-header-title">{{ props.title }}</text>
        <view v-if="props.showLocation" class="app-tab-header-location" @tap="handleLocationTap">
          <text class="app-tab-header-location-dot">●</text>
          <text class="app-tab-header-location-text">{{ locationLabel }}</text>
          <text class="app-tab-header-location-arrow">▾</text>
        </view>
      </view>
    </view>
  </view>

  <FloatingLoginPrompt />

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
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.9) 78%, rgba(255, 255, 255, 0) 100%);
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  box-sizing: border-box;
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

.app-tab-header-back {
  width: 58rpx;
  height: 58rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10rpx 24rpx rgba(17, 17, 17, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-tab-header-back-icon {
  color: #111310;
  font-size: 46rpx;
  line-height: 1;
  font-weight: 900;
  transform: translateY(-2rpx);
}

.app-tab-header-title {
  font-size: 36rpx;
  font-weight: 900;
  color: #131410;
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
  color: #111111;
  font-size: 18rpx;
}

.app-tab-header-location-text {
  font-size: 24rpx;
  color: #52584f;
  font-weight: 700;
}

.app-tab-header-location-arrow {
  color: #666d63;
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
  background: rgba(7, 9, 6, 0.42);
  padding: 28rpx;
  box-sizing: border-box;
}

.location-sheet {
  width: 100%;
  border-radius: 32rpx;
  background: #ffffff;
  padding: 28rpx;
  box-sizing: border-box;
  box-shadow: 0 28rpx 64rpx rgba(0, 0, 0, 0.18);
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
  color: #131410;
  font-weight: 900;
}

.location-sheet-copy {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #666d63;
}

.location-sheet-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 999rpx;
  background: #f1f3ec;
  color: #171814;
  font-size: 38rpx;
  line-height: 56rpx;
  text-align: center;
  flex-shrink: 0;
}

.location-sheet-map {
  width: 100%;
  height: 420rpx;
  margin-top: 24rpx;
  border-radius: 24rpx;
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
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 900;
}

.location-sheet-secondary {
  background: #f1f3ec;
  color: #191a17;
}

.location-sheet-primary {
  background: #c8ff00;
  color: #111111;
}
</style>
