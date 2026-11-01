<script setup lang="ts">
// #ifdef MP-WEIXIN
import { computed, ref } from "vue";
import { HOME_VISUAL_ASSETS } from "@/config/homeVisualAssets";
import { useMinioImages } from "@/composables/useMinioImages";
const { minioImageSrc } = useMinioImages();
const illustrationFailed = ref(false);
const illustrationSrc = computed(() => illustrationFailed.value ? "" : minioImageSrc(HOME_VISUAL_ASSETS.venueMap));
// #endif
function openMap() { uni.navigateTo({ url: "/pages/venues/map" }); }
</script>

<template>
  <button class="home-venue-map" hover-class="home-venue-map--pressed" @tap="openMap">
    <!-- #ifdef MP-WEIXIN -->
    <image v-if="illustrationSrc" class="home-venue-map__illustration" :src="illustrationSrc" mode="aspectFit" aria-hidden="true" @error="illustrationSrc && (illustrationFailed = true)" />
    <!-- #endif -->
    <view class="home-venue-map__icon"><wd-icon name="location" size="36rpx" /></view>
    <view class="home-venue-map__copy">
      <text class="home-venue-map__title">球场地图</text>
      <text class="home-venue-map__hint">找个球场，约下一场</text>
    </view>
    <text class="home-venue-map__arrow">→</text>
  </button>
</template>

<style scoped>
.home-venue-map { display: flex; align-items: center; gap: 20rpx; width: 100%; margin: 24rpx 0 0; padding: 22rpx 26rpx; border: var(--ui-border-default); border-radius: var(--ui-radius-card); background: var(--ui-color-surface); color: var(--ui-color-text); text-align: left; line-height: 1.4; box-sizing: border-box; }
.home-venue-map::after { border: 0; }
.home-venue-map__icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 68rpx; height: 68rpx; border-radius: var(--ui-radius-button); background: var(--ui-color-accent-soft); color: var(--ui-color-accent-deep); }
.home-venue-map__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.home-venue-map__title { font-size: 28rpx; font-weight: var(--ui-font-weight-heading); }
.home-venue-map__hint { font-size: 22rpx; color: var(--ui-color-text-muted); }
.home-venue-map__arrow { font-size: 32rpx; }
.home-venue-map--pressed { box-shadow: var(--ui-shadow-control-pressed); }
/* #ifdef MP-WEIXIN */
.home-venue-map { position: relative; min-height: 142rpx; overflow: hidden; }
.home-venue-map__illustration { position: absolute; right: 44rpx; top: 50%; width: 292rpx; height: 194rpx; transform: translateY(-50%); pointer-events: none; }
.home-venue-map__icon, .home-venue-map__copy, .home-venue-map__arrow { position: relative; }
.home-venue-map__copy { margin-right: 248rpx; }
/* #endif */
</style>
