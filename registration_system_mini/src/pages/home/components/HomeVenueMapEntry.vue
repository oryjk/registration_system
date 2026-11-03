<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
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
    <view class="home-venue-map__icon">
      <!-- #ifdef MP-WEIXIN -->
      <image class="home-venue-map__pin" src="/static/icons/lucide/map-pin.png" mode="aspectFit" aria-hidden="true" />
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <wd-icon name="location" size="var(--ui-icon-control)" />
      <!-- #endif -->
    </view>
    <view class="home-venue-map__copy">
      <text class="home-venue-map__title">球场地图</text>
      <text class="home-venue-map__hint">找个球场，约下一场</text>
    </view>
    <!-- #ifdef MP-WEIXIN -->
    <view class="home-venue-map__arrow"><AppIcon name="chevron-right" size="var(--ui-icon-md)" /></view>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <text class="ui-arrow-text home-venue-map__arrow">→</text>
    <!-- #endif -->
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
.home-venue-map { position: relative; min-height: var(--ui-home-map-height); gap: var(--ui-space-4); margin-top: var(--ui-space-4); padding: var(--ui-space-5) var(--ui-home-padding); overflow: hidden; border: var(--ui-panel-border); border-radius: var(--ui-home-radius); background: var(--ui-home-map-bg); box-shadow: none; }
.home-venue-map--pressed { background: var(--ui-home-map-pressed-bg); box-shadow: none; }
.home-venue-map__illustration { position: absolute; right: var(--ui-home-map-art-inset); top: 50%; width: var(--ui-home-map-art-width); height: var(--ui-home-map-art-height); transform: translateY(-50%); pointer-events: none; }
.home-venue-map__icon, .home-venue-map__copy, .home-venue-map__arrow { position: relative; }
.home-venue-map__icon { width: var(--ui-icon-lg); height: var(--ui-icon-xl); border-radius: 0; background: transparent; }
.home-venue-map__pin { width: var(--ui-icon-lg); height: var(--ui-icon-lg); }
.home-venue-map__copy { flex: 0 1 var(--ui-home-map-copy-width); margin-right: auto; }
.home-venue-map__title { font-size: var(--ui-text-title); white-space: nowrap; }
.home-venue-map__hint { color: var(--ui-home-map-muted); font-size: var(--ui-text-sm); white-space: nowrap; }
.home-venue-map__arrow { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: var(--ui-icon-md); height: var(--ui-icon-md); }
/* #endif */
</style>
