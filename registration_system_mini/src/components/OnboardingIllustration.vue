<script setup lang="ts">
import { useMinioImages } from "@/composables/useMinioImages";
import { ref, watch } from "vue";

const { minioImageSrc } = useMinioImages();

const props = defineProps<{ src: string; revision?: number }>();
const failed = ref(false);
watch(() => [props.src, props.revision], () => { failed.value = false; });
</script>

<template>
  <view v-if="src && !failed" class="onboarding-illustration" aria-hidden="true">
    <image :src="minioImageSrc(src)" mode="widthFix" class="onboarding-illustration__image" @error="minioImageSrc(src) && (failed = true)" />
  </view>
</template>

<style scoped>
.onboarding-illustration { display: flex; justify-content: center; }
.onboarding-illustration__image { display: block; width: 184rpx; }
</style>
