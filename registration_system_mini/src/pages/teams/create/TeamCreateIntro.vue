<script setup lang="ts">
import { computed, ref } from "vue";
import { useMinioImages } from "@/composables/useMinioImages";
import { HOME_VISUAL_ASSETS } from "@/config/homeVisualAssets";

const { minioImageSrc } = useMinioImages();
const failedBackground = ref(false);
const failedIllustration = ref(false);
const backgroundSrc = computed(() => failedBackground.value ? "" : minioImageSrc(HOME_VISUAL_ASSETS.hero));
const illustrationSrc = computed(() => failedIllustration.value ? "" : minioImageSrc(HOME_VISUAL_ASSETS.createTeam));
</script>

<template>
  <view class="team-create-intro">
    <image v-if="backgroundSrc" class="team-create-intro__background" :src="backgroundSrc" mode="aspectFill" aria-hidden="true" @error="backgroundSrc && (failedBackground = true)" />
    <view class="team-create-intro__shade" />
    <view class="team-create-intro__copy">
      <text class="team-create-intro__title">组建你的球队</text>
      <text class="team-create-intro__description">创建后你将成为队长，可邀请队友加入。</text>
    </view>
    <view class="team-create-intro__art" aria-hidden="true">
      <image v-if="illustrationSrc" class="team-create-intro__illustration" :src="illustrationSrc" mode="aspectFit" @error="illustrationSrc && (failedIllustration = true)" />
      <wd-icon v-else name="user-group" size="72rpx" />
    </view>
  </view>
</template>

<style scoped>
.team-create-intro { position: relative; display: flex; align-items: center; gap: 24rpx; min-height: 196rpx; margin-bottom: 24rpx; padding: 28rpx; border-radius: var(--ui-radius-card); overflow: hidden; background: var(--ui-color-hero); color: var(--now-cover-fg); box-sizing: border-box; }
.team-create-intro__background, .team-create-intro__shade { position: absolute; inset: 0; width: 100%; height: 100%; }
.team-create-intro__background { opacity: 0.36; }
.team-create-intro__shade { background: var(--now-cover-shade); }
.team-create-intro__copy { position: relative; display: flex; flex-direction: column; gap: 12rpx; flex: 1; min-width: 0; }
.team-create-intro__title { font-size: 34rpx; font-weight: var(--ui-font-weight-heading); line-height: 1.35; }
.team-create-intro__description { color: var(--now-cover-muted); font-size: 24rpx; line-height: 1.6; }
.team-create-intro__art { position: relative; display: flex; align-items: center; justify-content: center; flex: 0 0 144rpx; height: 144rpx; }
.team-create-intro__illustration { width: 144rpx; height: 144rpx; }
</style>
