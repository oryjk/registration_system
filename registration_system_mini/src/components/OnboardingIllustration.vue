<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ src: string; revision?: number }>();
const failed = ref(false);
watch(() => [props.src, props.revision], () => { failed.value = false; });
</script>

<template>
  <view v-if="src && !failed" class="onboarding-illustration" aria-hidden="true">
    <image :src="src" mode="widthFix" class="onboarding-illustration__image" @error="failed = true" />
  </view>
</template>

<style scoped>
.onboarding-illustration { display: flex; justify-content: center; }
.onboarding-illustration__image { display: block; width: 184rpx; }
</style>
