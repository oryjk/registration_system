<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ color: string }>();
const palette: Record<string, string> = {
  "#ffffff": "白色", "#ff0000": "红色", "#000000": "黑色",
  "#0000ff": "蓝色", "#00ff00": "绿色", "#ffff00": "黄色",
  "#22c55e": "绿色", "#ef4444": "红色", "#2f6bff": "蓝色",
  "#111310": "黑色", "#facc15": "黄色", "#ff6b35": "橙色",
  "#b34dff": "紫色", "#ec4899": "粉色", "#06b6d4": "青色",
  "#38bdf8": "天蓝", "#c8ff00": "荧光绿", "#d8dde6": "银灰",
  "#94a3b8": "灰色",
};
const namedColors: Record<string, string> = {
  白色: "#ffffff", 红色: "#ff0000", 黑色: "#000000",
  蓝色: "#0000ff", 绿色: "#008000", 黄色: "#ffff00",
  white: "#ffffff", red: "#ff0000", black: "#000000",
  blue: "#0000ff", green: "#008000", yellow: "#ffff00",
};
const value = computed(() => props.color.trim().toLowerCase());
const swatch = computed(() => {
  if (/^#[0-9a-f]{6}$/.test(value.value)) return value.value;
  if (/^#[0-9a-f]{3}$/.test(value.value)) return "#" + value.value.slice(1).split("").map(char => char + char).join("");
  return namedColors[value.value] || "";
});
const label = computed(() => {
  if (!value.value) return "队服待定";
  if (swatch.value) return palette[swatch.value] ? palette[swatch.value] + "队服" : "队服颜色";
  return props.color.trim() + "队服";
});
</script>

<template>
  <view class="team-kit">
    <view v-if="swatch" class="team-kit-swatch" :style="{ backgroundColor: swatch }" />
    <text>{{ label }}</text>
  </view>
</template>

<style scoped>
.team-kit { display: flex; align-items: center; justify-content: center; gap: 8rpx; color: var(--ui-color-text-muted); font-size: 20rpx; line-height: 1.4; }
.team-kit-swatch { width: 18rpx; height: 18rpx; flex-shrink: 0; border-radius: 5rpx; box-shadow: inset 0 0 0 1rpx rgba(0, 0, 0, 0.14); }
</style>
