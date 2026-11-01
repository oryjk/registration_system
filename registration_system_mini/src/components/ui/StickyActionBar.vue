<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, onUpdated, onUnmounted, ref, watch } from "vue";
import { getWindowMetrics } from "@/utils/systemInfo";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
  visible?: boolean;
  flat?: boolean;
  /** Reserve the measured height for taller action panels in the scrolling content. */
  reserveSpace?: boolean;
}>(), {
  visible: true,
  flat: false,
  reserveSpace: false,
});

const instance = getCurrentInstance();
const measuredHeight = ref(0);
let disposed = false;
let measurement = 0;
let listening = false;
const spacerStyle = computed(() => ({
  height: measuredHeight.value
    ? `calc(${measuredHeight.value}rpx + env(safe-area-inset-bottom) + var(--ui-action-bar-bottom) + var(--ui-card-gap))`
    : "var(--ui-action-bar-clearance)",
}));

async function measure() {
  if (!props.reserveSpace || !props.visible || disposed) return;
  const version = ++measurement;
  await nextTick();
  if (disposed || version !== measurement) return;
  uni.createSelectorQuery().in(instance?.proxy).select(".ui-sticky-action-bar")
    .boundingClientRect(result => {
      if (disposed || version !== measurement) return;
      const rect = Array.isArray(result) ? result[0] : result;
      if (!rect?.height) return;
      const height = rect.height * 750 / getWindowMetrics().windowWidth;
      if (Math.abs(height - measuredHeight.value) > 0.5) measuredHeight.value = height;
    }).exec();
}

watch(() => props.reserveSpace, enabled => {
  if (enabled && !listening) { uni.onWindowResize(measure); listening = true; }
  else if (!enabled && listening) { uni.offWindowResize(measure); listening = false; }
}, { immediate: true });
onMounted(measure);
onUpdated(measure);
onUnmounted(() => {
  disposed = true;
  measurement++;
  if (listening) uni.offWindowResize(measure);
});
</script>

<template>
  <view v-if="visible && reserveSpace" class="ui-sticky-action-spacer" :style="spacerStyle" aria-hidden="true" />
  <view v-if="visible" class="ui-sticky-action-bar" :class="[$attrs.class, { 'ui-sticky-action-bar--flat': flat }]" :style="$attrs.style">
    <view v-if="$slots.leading" class="ui-sticky-action-bar__leading">
      <slot name="leading" />
    </view>
    <view class="ui-sticky-action-bar__actions">
      <slot />
    </view>
  </view>
</template>

<style scoped>
.ui-sticky-action-spacer { flex-shrink: 0; pointer-events: none; }
.ui-sticky-action-bar {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + var(--ui-action-bar-bottom));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 16rpx;
  width: calc(100% - 48rpx);
  max-width: 702rpx;
  padding: var(--ui-action-bar-padding);
  border: var(--ui-border-strong);
  border-radius: var(--ui-action-bar-radius);
  background: var(--ui-action-bar-bg);
  box-shadow: var(--ui-action-bar-shadow);
  transform: translateX(-50%);
  box-sizing: border-box;
}

.ui-sticky-action-bar--flat {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.ui-sticky-action-bar__leading {
  min-width: 0;
  flex: 1;
}

.ui-sticky-action-bar__actions {
  display: flex;
  /* mp-weixin 下自定义组件有宿主节点，flex 行布局里宿主宽度收缩为内容宽，
     子组件内部 width:100% 无法撑满（H5 无此问题）；改用列方向 + stretch
     让宿主节点横向拉满，保证 block 按钮占满整个操作区。 */
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 12rpx;
  min-width: 0;
  flex: 1;
}

/* #ifdef MP-WEIXIN */
.ui-sticky-action-bar { gap: var(--ui-space-4); width: calc(100% - var(--ui-floating-action-inset) * 2); max-width: var(--ui-content-max-width); border: var(--ui-border-hairline); }
.ui-sticky-action-bar--flat { border: var(--ui-panel-border); }
.ui-sticky-action-bar__actions { gap: var(--ui-space-3); }
/* #endif */
</style>
