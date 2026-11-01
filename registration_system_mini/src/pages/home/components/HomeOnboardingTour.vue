<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import { prefersReducedMotion } from "@/utils/reducedMotion";

const props = defineProps<{
  creationAllowed: boolean;
  themeStyle: string;
  scope?: object;
}>();
const emit = defineEmits<{ (event: "finish"): void; (event: "error"): void }>();
const current = ref(0);
const visible = ref(false);
let disposed = false;
let settleTimer: ReturnType<typeof setTimeout> | undefined;

const steps = computed(() => {
  const all = [
    {
      element: "#home-onboarding-create-team",
      title: "创建我的球队",
      content: "想组织大家踢球？从这里建队，再邀请队友、安排比赛。",
    },
    {
      element: "#home-onboarding-join-team",
      title: "加入已有球队",
      content: "队友已经在用？从这里加入球队，之后就能跟队报名。",
    },
    {
      element: "#home-onboarding-browse",
      title: "找一场球踢",
      content: "想直接参加？从这里查看比赛，确认时间、地点和费用后报名。",
    },
  ];
  return props.creationAllowed ? all : all.slice(1);
});
const tourSteps = computed(() => steps.value);
const step = computed(() => steps.value[current.value] ?? steps.value[0]);
const lastStep = computed(() => current.value === steps.value.length - 1);

// 回顶由首页的 scroll-view 执行；等待其短动画结束再测量，不能让 Tour 的 pageScrollTo 代替回顶。
onMounted(() => {
  settleTimer = setTimeout(() => { if (!disposed) visible.value = true; }, 350);
  uni.onWindowResize(remeasure);
});
onUnmounted(() => {
  disposed = true;
  clearTimeout(settleTimer);
  uni.offWindowResize(remeasure);
});
async function remeasure() {
  if (!visible.value) return;
  visible.value = false;
  await nextTick();
  if (!disposed) visible.value = true;
}
watch(() => props.creationAllowed, async () => {
  current.value = 0;
  await remeasure();
});
function next() {
  if (lastStep.value) emit("finish");
  else current.value++;
}
</script>

<template>
  <wd-root-portal>
    <view class="app-theme-scope home-tour-theme" :style="themeStyle" @keydown.esc="emit('finish')">
      <view v-if="!visible" class="home-tour-pending" @tap.stop @touchmove.stop.prevent />
      <wd-tour
        :model-value="visible"
        v-model:current="current"
        :steps="tourSteps"
        :scope="scope"
        :show-tour-buttons="false"
        :duration="prefersReducedMotion() ? 0 : 180"
        :padding="6"
        :offset="16"
        :border-radius="12"
        :bottom-safety-offset="0"
        :z-index="180"
        missing-strategy="hide"
        @error="emit('error')"
      >
        <template #content>
          <view class="home-tour-panel" role="dialog" aria-modal="true" :aria-label="step.title" @tap.stop>
            <button class="home-tour-close" aria-label="关闭新手引导" @tap.stop="emit('finish')">×</button>
            <text class="home-tour-eyebrow">新手指引 · {{ current + 1 }}/{{ steps.length }}</text>
            <text class="home-tour-title">{{ step.title }}</text>
            <text class="home-tour-description">{{ step.content }}</text>
            <view class="home-tour-footer">
              <view class="home-tour-progress" :aria-label="`第 ${current + 1} 步，共 ${steps.length} 步`">
                <view v-for="(_, index) in steps" :key="index" class="home-tour-dot" :class="{ 'home-tour-dot--active': index === current }" />
              </view>
              <view class="home-tour-controls">
                <button v-if="current > 0" class="home-tour-link" @tap.stop="current--">上一步</button>
                <button v-else class="home-tour-link" @tap.stop="emit('finish')">跳过</button>
                <AppButton size="sm" @click="next">{{ lastStep ? '开始使用' : '下一步' }}</AppButton>
              </view>
            </view>
          </view>
        </template>
      </wd-tour>
    </view>
  </wd-root-portal>
</template>

<style scoped>
.home-tour-theme {
  --wot-tour-popover-bg: var(--ui-color-surface);
  --wot-tour-popover-radius: var(--ui-radius-card);
  --wot-tour-popover-padding: 28rpx;
  --wot-tour-popover-max-width: calc(100% - 56rpx);
  --wot-tour-popover-min-width: 0;
  --wot-tour-info-color: var(--ui-color-text);
  --wot-tour-highlight-shadow-color: var(--ui-color-overlay);
}
.home-tour-pending { position: fixed; inset: 0; z-index: 180; background: var(--ui-color-overlay); }
.home-tour-panel { position: relative; width: 560rpx; max-width: 100%; color: var(--ui-color-text); }
.home-tour-close { position: absolute; top: -18rpx; right: -18rpx; display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; margin: 0; padding: 0; border: 0; border-radius: var(--ui-radius-round); background: transparent; color: var(--ui-color-text-muted); font-size: 44rpx; line-height: 1; }
.home-tour-close::after, .home-tour-link::after { border: 0; }
.home-tour-eyebrow { display: block; padding-right: 48rpx; color: var(--ui-color-text-muted); font-size: 22rpx; line-height: 1.5; }
.home-tour-title { display: block; margin-top: 14rpx; padding-right: 32rpx; font-size: 34rpx; font-weight: var(--ui-font-weight-heading); line-height: 1.4; }
.home-tour-description { display: block; margin-top: 14rpx; color: var(--ui-color-text-muted); font-size: 26rpx; line-height: 1.65; }
.home-tour-footer { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 26rpx; }
.home-tour-progress { display: flex; align-items: center; gap: 8rpx; }
.home-tour-dot { width: 10rpx; height: 10rpx; border-radius: var(--ui-radius-round); background: var(--ui-color-line-strong); }
.home-tour-dot--active { width: 26rpx; background: var(--ui-color-accent); }
.home-tour-controls { display: flex; align-items: center; gap: 12rpx; }
.home-tour-link { display: flex; align-items: center; justify-content: center; min-height: 64rpx; margin: 0; padding: 0 10rpx; border: 0; background: transparent; color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 1.4; }
</style>
