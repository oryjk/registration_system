<script setup lang="ts">
import { computed, ref } from "vue";
import { useMinioImages } from "@/composables/useMinioImages";

const props = withDefaults(defineProps<{
  title: string;
  description?: string;
  imageUrl?: string;
  backgroundUrl?: string;
  tone?: "soft" | "hero";
}>(), { description: "", imageUrl: "", backgroundUrl: "", tone: "soft" });
const { minioImageSrc } = useMinioImages();
const failed = ref<string[]>([]);
function imageSrc(url: string) { return failed.value.includes(url) ? "" : minioImageSrc(url); }
function imageError(url: string) { if (minioImageSrc(url)) failed.value = [...failed.value, url]; }
const illustration = computed(() => imageSrc(props.imageUrl));
const background = computed(() => imageSrc(props.backgroundUrl));
</script>

<template>
  <view :class="['ui-page-intro', `ui-page-intro--${tone}`]">
    <image v-if="background" class="ui-page-intro__background" :src="background" mode="aspectFill" aria-hidden="true" @error="imageError(backgroundUrl)" />
    <view v-if="background && tone === 'hero'" class="ui-page-intro__shade" />
    <view class="ui-page-intro__copy">
      <text class="ui-page-intro__title">{{ title }}</text>
      <text v-if="description" class="ui-page-intro__description">{{ description }}</text>
    </view>
    <image v-if="illustration" class="ui-page-intro__illustration" :src="illustration" mode="aspectFit" aria-hidden="true" @error="imageError(imageUrl)" />
  </view>
</template>

<style scoped>
.ui-page-intro { position: relative; display: flex; align-items: center; gap: var(--ui-intro-gap); min-height: var(--ui-intro-min-height); padding: var(--ui-intro-padding); border-radius: var(--ui-radius-card); overflow: hidden; background: var(--ui-panel-soft-bg); color: var(--ui-color-text); box-sizing: border-box; }
.ui-page-intro--hero { background: var(--ui-color-hero); color: var(--now-cover-fg); }
.ui-page-intro__background, .ui-page-intro__shade { position: absolute; inset: 0; width: 100%; height: 100%; }
.ui-page-intro__background { opacity: var(--ui-intro-background-opacity); }
.ui-page-intro__shade { background: var(--now-cover-shade); }
.ui-page-intro__copy { position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0; gap: var(--ui-space-3); }
.ui-page-intro__title { font-size: var(--ui-text-heading); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); overflow-wrap: anywhere; }
.ui-page-intro__description { color: var(--ui-color-text-muted); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.ui-page-intro--hero .ui-page-intro__description { color: var(--now-cover-muted); }
.ui-page-intro__illustration { position: relative; flex-shrink: 0; width: var(--ui-intro-illustration-size); height: var(--ui-intro-illustration-size); }
</style>
