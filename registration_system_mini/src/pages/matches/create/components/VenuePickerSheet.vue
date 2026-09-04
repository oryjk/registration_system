<script setup lang="ts">
import { computed, ref, watch } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import type { BackendVenueSuggestion } from "@/api/match";

// 发布比赛的场地选择弹层：常用场地（历史聚合）+ 手动输入 + 地图选点，
// 优先选常用场地以减少地图选点 API 消耗。
const props = defineProps<{
  visible: boolean;
  suggestions: BackendVenueSuggestion[];
  loading: boolean;
  currentLocation: string;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "select", venue: BackendVenueSuggestion): void;
  (event: "manualInput", location: string): void;
  (event: "chooseLocation"): void;
}>();

const draftLocation = ref("");

watch(
  () => props.visible,
  (visible) => {
    if (visible) draftLocation.value = props.currentLocation;
  },
);

const canConfirmManual = computed(() => !!draftLocation.value.trim());

function handleConfirmManual() {
  const location = draftLocation.value.trim();
  if (!location) return;
  emit("manualInput", location);
}

function handleSelect(venue: BackendVenueSuggestion) {
  emit("select", venue);
}
</script>

<template>
  <view v-if="visible" class="venue-picker-mask" @tap="emit('close')">
    <view class="venue-picker-sheet" @tap.stop>
      <view class="venue-picker-head">
        <view class="venue-picker-head__texts">
          <text class="venue-picker-head__title">选择场地</text>
          <text class="venue-picker-head__caption">优先选择常用场地，可减少地图选点</text>
        </view>
        <view class="venue-picker-head__close" @tap="emit('close')">×</view>
      </view>

      <view class="venue-picker-field">
        <input
          v-model="draftLocation"
          class="venue-picker-input"
          placeholder="手动输入球场/地址"
          placeholder-class="venue-picker-placeholder"
          confirm-type="done"
          @confirm="handleConfirmManual"
        />
        <NeoButton class="venue-picker-field__action" size="sm" :disabled="!canConfirmManual" @click="handleConfirmManual">
          使用
        </NeoButton>
      </view>

      <view class="venue-picker-list-head">
        <text class="venue-picker-list-head__label">常用场地</text>
        <text v-if="loading" class="venue-picker-list-head__state">加载中...</text>
      </view>
      <scroll-view class="venue-picker-list" scroll-y>
        <NeoSurface
          v-for="venue in suggestions"
          :key="venue.location"
          interactive
          flush
          @tap="handleSelect(venue)"
        >
          <view class="venue-picker-option" :class="{ 'venue-picker-option--current': venue.location === currentLocation }">
            <view class="venue-picker-option__copy">
              <text class="venue-picker-option__name">{{ venue.location }}</text>
            </view>
            <text v-if="venue.location === currentLocation" class="venue-picker-option__mark">当前</text>
          </view>
        </NeoSurface>
        <view v-if="!loading && !suggestions.length" class="venue-picker-empty">
          <text class="venue-picker-empty__text">还没有常用场地记录</text>
        </view>
      </scroll-view>

      <NeoButton class="venue-picker-map" variant="outline" block @click="emit('chooseLocation')">
        用地图选择地点
      </NeoButton>
    </view>
  </view>
</template>

<style scoped>
.venue-picker-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: flex-end;
  background: rgba(11, 14, 10, 0.34);
  animation: venue-picker-mask-fade-in 220ms ease;
}

.venue-picker-sheet {
  width: 100%;
  max-height: 74vh;
  padding: 34rpx 28rpx calc(env(safe-area-inset-bottom) + 28rpx);
  border: var(--neo-border-strong);
  border-bottom: none;
  border-radius: var(--neo-radius-md) var(--neo-radius-md) 0 0;
  background: var(--neo-surface-bg);
  box-shadow: var(--neo-surface-shadow);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  animation: venue-picker-sheet-enter 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.venue-picker-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  flex-shrink: 0;
}

.venue-picker-head__texts {
  min-width: 0;
}

.venue-picker-head__title {
  display: block;
  color: var(--neo-color-text);
  font-size: 34rpx;
  line-height: 44rpx;
  font-weight: 900;
}

.venue-picker-head__caption {
  display: block;
  margin-top: 8rpx;
  color: var(--neo-color-text-muted);
  font-size: 23rpx;
  line-height: 1.5;
  font-weight: 700;
}

.venue-picker-head__close {
  width: 56rpx;
  height: 56rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-round);
  background: var(--neo-surface-bg);
  color: var(--neo-color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  line-height: 1;
  flex-shrink: 0;
  box-sizing: border-box;
}

.venue-picker-field {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 22rpx;
  flex-shrink: 0;
}

.venue-picker-input {
  flex: 1;
  min-width: 0;
  height: 84rpx;
  padding: 0 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-page);
  font-size: 28rpx;
  color: var(--neo-color-text);
  box-sizing: border-box;
}

.venue-picker-list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 26rpx;
  flex-shrink: 0;
}

.venue-picker-list-head__label {
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.venue-picker-list-head__state {
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
}

.venue-picker-list {
  flex: 1;
  min-height: 0;
  margin-top: 12rpx;
  max-height: 40vh;
}

.venue-picker-list :deep(.neo-surface) {
  display: block;
  margin-bottom: 14rpx;
}

.venue-picker-option {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 96rpx;
  padding: 16rpx;
  box-sizing: border-box;
}

.venue-picker-option--current {
  background: var(--neo-color-info-soft);
}

.venue-picker-option__copy {
  min-width: 0;
  flex: 1;
}

.venue-picker-option__name {
  display: block;
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.3;
  word-break: break-word;
}

.venue-picker-option__mark {
  flex-shrink: 0;
  padding: 4rpx 12rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-round);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 20rpx;
  font-weight: 900;
}

.venue-picker-empty {
  display: flex;
  justify-content: center;
  padding: 40rpx 0;
}

.venue-picker-empty__text {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
}

.venue-picker-map {
  flex-shrink: 0;
  margin-top: 22rpx;
}

@keyframes venue-picker-mask-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes venue-picker-sheet-enter {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}
</style>
