<script setup lang="ts">
import { computed, ref } from "vue";
import { useAccentTheme } from "@/stores/theme";
import { getThemeWindowBackground } from "@/config/themePalettes";
import { getCustomNavMetrics } from "@/utils/customNav";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import type { AppScrollController } from "./appScroll";

const props = defineProps<{
  /** 下拉刷新进行中（refresher-triggered），由页面刷新状态驱动。 */
  refreshing?: boolean;
  /** 滚动锁定：页面弹层打开时置 true，替代原 page-meta overflow 滚动锁。 */
  locked?: boolean;
}>();

const emit = defineEmits<{
  (event: "refresh"): void;
  (event: "reachBottom"): void;
}>();

const { accentTheme } = useAccentTheme();
const refresherBackground = computed(() => getThemeWindowBackground(accentTheme.value));
const refreshStatusStyle = { top: `${getCustomNavMetrics().pageTopPadding + 16}px` };

// scroll-top 受控跟踪：每次滚动回写当前值，回顶赋 0 才会触发真实滚动。
const scrollTop = ref(0);

function handleScroll(event: { detail: { scrollTop: number } }) {
  scrollTop.value = event.detail.scrollTop;
}

// 由页面持有模板 ref 并 provide 给组件树（AppTabHeader 等），见 createAppScrollAnchor。
defineExpose<AppScrollController>({
  scrollToTop: () => {
    scrollTop.value = 0;
  },
});
</script>

<template>
  <view class="app-pull-scroll-shell">
    <scroll-view
      class="app-pull-scroll"
      :scroll-y="!props.locked"
      :scroll-top="scrollTop"
      scroll-with-animation
      refresher-enabled
      :refresher-triggered="props.refreshing"
      refresher-default-style="none"
      :refresher-background="refresherBackground"
      @refresherrefresh="emit('refresh')"
      @scrolltolower="emit('reachBottom')"
      @scroll="handleScroll"
    >
      <slot />
    </scroll-view>
    <view v-if="props.refreshing" class="app-pull-scroll__status" :style="refreshStatusStyle">
      <RunningLoader compact text="正在刷新，拉取最新数据…" />
    </view>
  </view>
</template>

<style scoped>
/* 页面级滚动容器占满视口；页面自身不再滚动，固定 header/底栏因此不受下拉拖动影响。 */
.app-pull-scroll-shell {
  position: relative;
  height: 100vh;
}

.app-pull-scroll {
  height: 100%;
}

.app-pull-scroll__status {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 9;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
</style>
