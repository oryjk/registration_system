<script setup lang="ts">
import { computed } from "vue";
import type { AppIconName } from "./appIconNames";

const props = withDefaults(defineProps<{
  name: AppIconName;
  size?: string;
  tone?: "default" | "muted";
}>(), {
  size: "var(--ui-icon-md)",
  tone: "default",
});

const source = computed(() => `/static/app-icons/${props.name}-${props.tone}.png`);
const iconStyle = computed(() => ({ width: props.size, height: props.size }));
</script>

<script lang="ts">
export default { options: { virtualHost: true } };
</script>

<template>
  <image class="ui-icon" :src="source" :style="iconStyle" mode="aspectFit" aria-hidden="true" />
</template>

<style scoped>
.ui-icon { display: block; flex-shrink: 0; vertical-align: middle; }
</style>
