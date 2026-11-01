<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMinioImages } from "@/composables/useMinioImages";
import { resolveHomeMatchThumbnail } from "../homeMatchThumbnail";

const props = defineProps<{ match: { id: string; coverImageUrl?: string } }>();
const { minioImageSrc } = useMinioImages();
const failedUrls = ref<string[]>([]);
watch(() => [props.match.id, props.match.coverImageUrl], () => { failedUrls.value = []; });
const url = computed(() => resolveHomeMatchThumbnail(props.match, failedUrls.value));
const src = computed(() => minioImageSrc(url.value));

function handleError() {
  // 空 src 表示缓存下载尚未返回，不将它当作远程图片失败。
  if (src.value && url.value) failedUrls.value = [...failedUrls.value, url.value];
}
</script>

<template>
  <view class="home-match-thumbnail" aria-hidden="true">
    <image v-if="src" :key="url" class="home-match-thumbnail__image" :src="src" mode="aspectFill" lazy-load @error="handleError" />
    <wd-icon v-else name="image" size="38rpx" />
  </view>
</template>

<style scoped>
/* 在父卡片的原生定位容器内铺满，不依赖小程序组件宿主的百分比高度。 */
.home-match-thumbnail { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--ui-color-neutral-bg); color: var(--ui-color-text-muted); }
.home-match-thumbnail__image { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
</style>
