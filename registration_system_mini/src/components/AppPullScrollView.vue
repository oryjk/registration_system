<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
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

// 用户滚动只记录位置，不能回写 scroll-top，否则原生滚动会被新的定位命令打断。
const scrollTop = ref(0);
let currentScrollTop = 0;

function handleScroll(event: { detail: { scrollTop: number } }) {
  currentScrollTop = event.detail.scrollTop;
}

// 主动回顶时先同步当前位置，再在下一次渲染写 0，支持重复回顶。
defineExpose<AppScrollController>({
  scrollToTop: async () => {
    scrollTop.value = currentScrollTop;
    await nextTick();
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
