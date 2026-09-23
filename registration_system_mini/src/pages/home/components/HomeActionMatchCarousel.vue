<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import HomeSectionHeader from './HomeSectionHeader.vue';
import HomeActionMatchCard from './HomeActionMatchCard.vue';
import type { HomeMatchCardViewModel } from '@/types/viewModels';
import type { AvatarItem } from '@/components/ui/avatarTypes';
import type { HomeMatchDetailEntry } from '../useHomeActionDeckDetails';
import { getWindowMetrics } from '@/utils/systemInfo';
import { prefersReducedMotion } from '@/utils/reducedMotion';

const props = defineProps<{
  matches: HomeMatchCardViewModel[];
  index: number;
  details: Record<string, HomeMatchDetailEntry>;
  navigatingMatchId: string | null;
  now: number;
}>();
const emit = defineEmits<{
  (event: 'change', index: number): void;
  (event: 'matchTap', match: HomeMatchCardViewModel): void;
  (event: 'retry'): void;
  (event: 'avatarSelect', avatar: AvatarItem): void;
}>();
const instance = getCurrentInstance();
const height = ref(getWindowMetrics().windowWidth * 780 / 750);
const swiping = ref(false);
const rosterExpanded = ref(false);
const pageVisible = ref(true);
onShow(() => { pageVisible.value = true; });
onHide(() => { pageVisible.value = false; });
watch(() => props.index, () => { rosterExpanded.value = false; });
function isNearby(slideIndex: number) {
  const distance = Math.abs(slideIndex - props.index);
  return Math.min(distance, props.matches.length - distance) <= 1;
}
const duration = prefersReducedMotion() ? 0 : 220;
let disposed = false;
let measurement = 0;

async function measureActiveCard() {
  const version = ++measurement;
  await nextTick();
  if (disposed) return;
  uni.createSelectorQuery().in(instance?.proxy).select(`.match-slide-${props.index}`)
    .boundingClientRect(result => {
      if (disposed || version !== measurement) return;
      const rect = Array.isArray(result) ? result[0] : result;
      if (typeof rect?.height === 'number' && rect.height > 0) height.value = rect.height;
    }).exec();
}
function change(event: { detail: { current: number } }) {
  emit('change', event.detail.current);
}
// 滑动期间只拦截重复操作，不改变按钮外观；禁用状态仅由首尾位置决定。
function step(delta: number) {
  if (props.matches.length < 2 || swiping.value) return;
  const next = props.index + delta;
  if (next < 0 || next >= props.matches.length) return;
  emit('change', next);
}
function transition(event: { detail: { dx: number } }) {
  if (Math.abs(event.detail.dx) > 1) swiping.value = true;
}
function finish() {
  swiping.value = false;
  void measureActiveCard();
}
watch(() => [props.index, props.details, props.matches], () => { void measureActiveCard(); }, { flush: 'post' });
onMounted(() => { void measureActiveCard(); uni.onWindowResize(measureActiveCard); });
onUnmounted(() => { disposed = true; measurement++; uni.offWindowResize(measureActiveCard); });
</script>

<template>
  <view class="match-carousel">
    <HomeSectionHeader title="最近要处理">
      <template #actions>
        <view v-if="matches.length > 1" class="match-actions">
          <button class="match-arrow" :class="{ 'match-arrow--disabled': index === 0 }" :disabled="index === 0" aria-label="上一场比赛" @tap="step(-1)">←</button>
          <button class="match-arrow" :class="{ 'match-arrow--disabled': index === matches.length - 1 }" :disabled="index === matches.length - 1" aria-label="下一场比赛" @tap="step(1)">→</button>
        </view>
      </template>
    </HomeSectionHeader>
    <swiper class="match-swiper" :style="{ height: `${height}px` }" :current="index" :duration="duration" :circular="matches.length > 1" :autoplay="matches.length > 1 && pageVisible && !rosterExpanded && !navigatingMatchId" :interval="5000" @change="change" @transition="transition" @animationfinish="finish">
      <swiper-item v-for="(match, slideIndex) in matches" :key="match.id">
        <view class="match-slide" :class="`match-slide-${slideIndex}`">
          <HomeActionMatchCard
            v-if="isNearby(slideIndex)"
            :match="match"
            :detail="details[match.id]?.detail ?? null"
            :loading="details[match.id]?.loading ?? false"
            :error="details[match.id]?.error ?? false"
            :navigating="navigatingMatchId === match.id"
            :now="now"
            :active="slideIndex === index"
            :page-count="matches.length"
            :page-index="slideIndex"
            :interaction-blocked="slideIndex !== index"
            @match-tap="emit('matchTap', $event)"
            @retry="emit('retry')"
            @avatar-select="emit('avatarSelect', $event)"
            @layout-change="measureActiveCard"
            @expanded-change="slideIndex === index && (rosterExpanded = $event)"
          />
        </view>
      </swiper-item>
    </swiper>
  </view>
</template>

<style scoped>
.match-carousel { min-width: 0; }
.match-actions { display: flex; gap: 12rpx; }
.match-arrow { display: flex; align-items: center; justify-content: center; margin: 0; padding: 0; width: 64rpx; height: 64rpx; line-height: 64rpx; border-radius: 50%; background: var(--now-color-soft); color: var(--now-color-accent-text); font-size: 30rpx; }
.match-arrow::after { border: 0; }
.match-arrow--disabled { opacity: 0.3; }
.match-slide { display: flex; flex-direction: column; box-sizing: border-box; padding: 0 4rpx 24rpx; }
</style>
