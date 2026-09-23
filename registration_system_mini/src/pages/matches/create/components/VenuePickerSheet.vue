<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { prefersReducedMotion } from "@/utils/reducedMotion";
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
  (event: "preview", venue: BackendVenueSuggestion): void;
  (event: "manualInput", location: string): void;
  (event: "chooseLocation"): void;
}>();

// 底部弹层退场时序：淡出下滑期间遮罩继续拦截点击（防点穿），结束才卸载。
const { rendered, leaving } = useOverlayPresence(
  computed(() => props.visible),
  { leaveDurationMs: () => prefersReducedMotion() ? 0 : 210 },
);

function handleClose() {
  if (!rendered.value || leaving.value) return;
  emit("close");
}

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
  if (!location || leaving.value) return;
  emit("manualInput", location);
}

function handleSelect(venue: BackendVenueSuggestion) {
  if (leaving.value) return;
  emit("select", venue);
}
</script>

<template>
  <view v-if="rendered" :class="['venue-picker-mask', leaving ? 'venue-picker-mask--leaving' : '']" @tap="handleClose">
    <view class="venue-picker-sheet" @tap.stop>
      <view class="venue-picker-head">
        <view class="venue-picker-head__texts">
          <text class="venue-picker-head__title">选择场地</text>
          <text class="venue-picker-head__caption">常用场地一键选，也可以输入地址</text>
        </view>
        <button class="venue-picker-close" hover-class="venue-picker-control--pressed" aria-label="关闭场地选择" @tap="handleClose">
          <wd-icon name="close" size="28rpx" />
        </button>
      </view>

      <view class="venue-picker-manual">
        <text class="venue-picker-label">手动输入</text>
        <view class="venue-picker-field">
          <view class="venue-picker-input-shell">
            <view class="venue-picker-input-icon" aria-hidden="true">
              <wd-icon name="edit" size="30rpx" />
            </view>
            <input
              v-model="draftLocation"
              class="venue-picker-input"
              placeholder="球场名称或详细地址"
              placeholder-class="venue-picker-placeholder"
              confirm-type="done"
              @confirm="handleConfirmManual"
            />
          </view>
          <view class="venue-picker-field__action">
            <AppButton :disabled="!canConfirmManual" @click="handleConfirmManual">使用</AppButton>
          </view>
        </view>
      </view>

      <view class="venue-picker-list-head">
        <text class="venue-picker-label">常用场地</text>
        <text class="venue-picker-list-head__state">{{ loading ? "加载中…" : "点击即可使用" }}</text>
      </view>
      <scroll-view class="venue-picker-list" scroll-y>
        <view v-if="suggestions.length" class="venue-picker-options">
          <view
            v-for="venue in suggestions"
            :key="venue.location"
            class="venue-picker-option"
            :class="{ 'venue-picker-option--current': venue.location === currentLocation }"
          >
            <button class="venue-picker-option__select" hover-class="venue-picker-control--pressed" @tap="handleSelect(venue)">
              <view class="venue-picker-option__icon" aria-hidden="true">
                <wd-icon name="location" size="32rpx" />
              </view>
              <text class="venue-picker-option__name">{{ venue.location }}</text>
              <view v-if="venue.location === currentLocation" class="venue-picker-option__current">
                <text>当前</text>
                <wd-icon name="check" size="28rpx" />
              </view>
            </button>
            <button
              class="venue-picker-option__map"
              hover-class="venue-picker-control--pressed"
              :aria-label="'在地图查看' + venue.location"
              @tap.stop="!leaving && emit('preview', venue)"
            >
              <wd-icon name="location" size="26rpx" />
              <text>看地图</text>
            </button>
          </view>
        </view>
        <view v-if="!suggestions.length" class="venue-picker-empty">
          <view class="venue-picker-empty__icon" aria-hidden="true">
            <wd-icon name="location" size="40rpx" />
          </view>
          <text class="venue-picker-empty__title">{{ loading ? "正在加载常用场地…" : "还没有常用场地" }}</text>
          <text v-if="!loading" class="venue-picker-empty__text">输入球场名称，或用地图选择地点</text>
        </view>
      </scroll-view>

      <view class="venue-picker-footer">
        <AppButton variant="outline" block @click="emit('chooseLocation')">
          <view class="venue-picker-map-label">
            <wd-icon name="location" size="30rpx" />
            <text>用地图选择地点</text>
          </view>
        </AppButton>
      </view>
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
  justify-content: center;
  background: var(--ui-color-overlay);
  animation: venue-picker-mask-fade-in var(--ui-motion-overlay-duration) ease;
}

/* 退场遮罩继续拦截点击，保留原有防点穿行为。 */
.venue-picker-mask--leaving {
  animation: venue-picker-mask-fade-out var(--ui-motion-overlay-duration) ease forwards;
}

.venue-picker-mask--leaving .venue-picker-sheet {
  pointer-events: none;
  animation: venue-picker-sheet-exit var(--ui-motion-overlay-duration) var(--ui-motion-ease-out) forwards;
}

.venue-picker-sheet {
  width: 100%;
  max-width: 750rpx;
  max-height: 85%;
  padding: 32rpx 28rpx calc(env(safe-area-inset-bottom) + 24rpx);
  border-radius: var(--ui-radius-card) var(--ui-radius-card) 0 0;
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  box-shadow: var(--ui-shadow-modal);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  animation: venue-picker-sheet-enter var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
}

.venue-picker-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  flex-shrink: 0;
}

.venue-picker-head__texts { min-width: 0; }

.venue-picker-head__title {
  display: block;
  font-size: 34rpx;
  line-height: 1.3;
  font-weight: var(--ui-font-weight-heading);
}

.venue-picker-head__caption {
  display: block;
  margin-top: 10rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 1.5;
}

.venue-picker-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text-muted);
  line-height: 1;
}

.venue-picker-close::after,
.venue-picker-option__select::after,
.venue-picker-option__map::after { border: 0; }

.venue-picker-manual {
  margin-top: 30rpx;
  flex-shrink: 0;
}

.venue-picker-label {
  font-size: 24rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.5;
}

.venue-picker-field {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 12rpx;
}

.venue-picker-input-shell {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 88rpx;
  gap: 12rpx;
  padding: 0 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.venue-picker-input-icon {
  display: flex;
  flex-shrink: 0;
  color: var(--ui-color-text-muted);
}

.venue-picker-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font-size: 26rpx;
  color: var(--ui-color-text);
}

.venue-picker-placeholder { color: var(--ui-color-text-disabled); }
.venue-picker-field__action { flex-shrink: 0; }

.venue-picker-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 28rpx;
  margin-bottom: 14rpx;
  flex-shrink: 0;
}

.venue-picker-list-head__state {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
}

.venue-picker-list {
  height: 416rpx;
  min-height: 0;
  flex-shrink: 1;
}

.venue-picker-options {
  overflow: hidden;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
}

.venue-picker-option {
  display: flex;
  align-items: center;
  gap: 12rpx;
  width: 100%;
  min-height: 100rpx;
  margin: 0;
  padding: 0 16rpx 0 0;
  border: 0;
  border-radius: 0;
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  text-align: left;
  line-height: 1.5;
  box-sizing: border-box;
}

.venue-picker-option__select {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex: 1;
  min-width: 0;
  min-height: 100rpx;
  margin: 0;
  padding: 22rpx 0 22rpx 16rpx;
  background: transparent;
  color: inherit;
  border: 0;
  border-radius: 0;
  text-align: left;
  line-height: 1.5;
}

.venue-picker-option__map {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  flex-shrink: 0;
  min-height: 64rpx;
  margin: 0;
  padding: 0 12rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 22rpx;
  line-height: 1;
}

.venue-picker-option + .venue-picker-option { border-top: var(--ui-border-default); }
.venue-picker-option--current { background: var(--ui-color-accent-soft); }

.venue-picker-option__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  flex-shrink: 0;
  color: var(--ui-color-text-muted);
}

.venue-picker-option__name {
  min-width: 0;
  flex: 1;
  font-size: 28rpx;
  font-weight: 400;
  overflow-wrap: anywhere;
}

.venue-picker-option--current .venue-picker-option__name {
  font-weight: var(--ui-font-weight-heading);
}

.venue-picker-option__current {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
  color: var(--ui-color-accent-deep);
  font-size: 22rpx;
}

.venue-picker-control--pressed { opacity: 0.65; }

.venue-picker-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-height: 300rpx;
  gap: 12rpx;
  padding: 24rpx;
  box-sizing: border-box;
}

.venue-picker-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 4rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text-muted);
}

.venue-picker-empty__title { font-size: 26rpx; }
.venue-picker-empty__text { font-size: 22rpx; color: var(--ui-color-text-muted); }

.venue-picker-footer {
  flex-shrink: 0;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: var(--ui-border-default);
}

.venue-picker-map-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

@keyframes venue-picker-mask-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes venue-picker-mask-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes venue-picker-sheet-enter { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes venue-picker-sheet-exit { from { transform: translateY(0); } to { transform: translateY(100%); } }

@media (prefers-reduced-motion: reduce) {
  .venue-picker-mask,
  .venue-picker-mask--leaving,
  .venue-picker-sheet,
  .venue-picker-mask--leaving .venue-picker-sheet { animation: none; }
}
</style>
