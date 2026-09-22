<script setup lang="ts">
import { getCurrentInstance, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { prefersReducedMotion } from "@/utils/reducedMotion";

/**
 * 平滑展开/收起容器：真实测量内容高度后过渡（展开 0→实测高，收起 实测高→0），
 * 不用巨大 max-height 伪造均速，也不直接切换 auto 高度。
 * 展开动画结束后回落 auto，内容后续自身增高（如图片加载）不被裁切。
 * 快速反向切换用世代计数丢弃过期回调；卸载清理定时器。
 */
const props = withDefaults(
  defineProps<{
    visible: boolean;
  }>(),
  {
    visible: false,
  },
);

// 与 --ui-motion-expand-duration 保持一致（JS 无法读取 CSS 变量）。
const DURATION_MS = 220;

const instance = getCurrentInstance();
const rendered = ref(props.visible);
const containerHeight = ref<string>(props.visible ? "auto" : "0px");
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

function clearSettleTimer() {
  if (settleTimer !== undefined) {
    clearTimeout(settleTimer);
    settleTimer = undefined;
  }
}

let disposed = false;
const frameWaits = new Map<ReturnType<typeof setTimeout>, () => void>();
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { frameWaits.delete(timer); resolve(); }, 32);
    frameWaits.set(timer, resolve);
  });
}

function queryHeight(selector: string): Promise<number> {
  return new Promise((resolve) => {
    const query = uni.createSelectorQuery().in(instance?.proxy);
    query.select(selector).boundingClientRect();
    query.exec((rects) => {
      const rect = rects?.[0] as { height?: number } | undefined;
      resolve(rect && typeof rect.height === "number" ? rect.height : 0);
    });
  });
}

watch(
  () => props.visible,
  async (visible) => {
    const currentGeneration = ++generation;
    clearSettleTimer();

    if (prefersReducedMotion()) {
      rendered.value = visible;
      containerHeight.value = visible ? "auto" : "0px";
      return;
    }

    // 反向切换从当前可见容器高度继续，不跳回 0 或完整内容高度。
    const from = rendered.value ? await queryHeight(".smooth-collapse") : 0;
    if (disposed || currentGeneration !== generation) return;
    rendered.value = true;
    containerHeight.value = `${from}px`;
    await nextTick();
    if (disposed || currentGeneration !== generation) return;
    const target = visible ? await queryHeight(".smooth-collapse__content") : 0;
    if (disposed || currentGeneration !== generation) return;
    await nextFrame();
    if (disposed || currentGeneration !== generation) return;
    containerHeight.value = `${target}px`;
    settleTimer = setTimeout(() => {
      if (disposed || currentGeneration !== generation) return;
      if (visible) containerHeight.value = "auto";
      else rendered.value = false;
    }, DURATION_MS);
  },
);

onBeforeUnmount(() => {
  disposed = true;
  generation += 1;
  clearSettleTimer();
  for (const [timer, resolve] of frameWaits) { clearTimeout(timer); resolve(); }
  frameWaits.clear();
});
</script>

<template>
  <view v-if="rendered" class="smooth-collapse" :style="{ height: containerHeight }">
    <view class="smooth-collapse__content">
      <slot />
    </view>
  </view>
</template>

<style scoped>
.smooth-collapse {
  height: 0;
  overflow: hidden;
  transition: height var(--ui-motion-expand-duration) var(--ui-motion-ease-out);
}

.smooth-collapse__content {
  min-height: 0;
}

/* H5 减少动态效果：直接展开/收起。 */
@media (prefers-reduced-motion: reduce) {
  .smooth-collapse {
    transition: none;
  }
}
</style>
