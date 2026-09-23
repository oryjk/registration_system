<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";
import { prefersReducedMotion } from "@/utils/reducedMotion";

const props = defineProps<{
  visible: boolean;
  /** 可报人数上限（剩余名额，调整人数时含本人当前占用）。 */
  maxCount: number;
  /** 当前已报人数（调整时预填）。 */
  currentCount: number;
  /** 人均费用标签（如 ¥25.00）；空串表示无确定金额，结合 feeType 区分免费与线下 AA。 */
  feePerPersonLabel?: string;
  feeType?: import("@/types/match").AppMatchFeeType;
  submitting?: boolean;
  /** 已报名未支付时展示「取消报名」次按钮。 */
  canCancel?: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "confirm", count: number): void;
  (event: "cancelRegistration"): void;
}>();

// 底部弹层退场时序：淡出下滑期间遮罩继续拦截点击（防点穿），结束才放行。
const { rendered, leaving } = useOverlayPresence(
  computed(() => props.visible),
  { leaveDurationMs: () => prefersReducedMotion() ? 0 : 210 },
);

const count = ref(props.currentCount || 1);
watch(
  () => props.visible,
  (visible) => {
    if (visible) count.value = Math.max(Math.min(props.currentCount || 1, maxCount.value), 1);
  },
);

const maxCount = computed(() => Math.max(props.maxCount, 1));
const isAdjusting = computed(() => props.canCancel && props.currentCount >= 1);
const confirmText = computed(() => (isAdjusting.value ? "调整人数" : "确认报名"));
const totalFeeLabel = computed(() => {
  if (!props.feePerPersonLabel) return "";
  const perPerson = Number(props.feePerPersonLabel.replace("¥", ""));
  if (!Number.isFinite(perPerson)) return "";
  return `¥${(perPerson * count.value).toFixed(2)}`;
});

function handleClose() {
  if (!rendered.value || leaving.value) return;
  emit("close");
}

function handleConfirm() {
  if (props.visible && rendered.value && !props.submitting && !leaving.value) emit("confirm", count.value);
}

function handleCancelRegistration() {
  if (props.visible && rendered.value && !props.submitting && !leaving.value) emit("cancelRegistration");
}
</script>

<template>
  <view
    v-if="rendered"
    :class="[
      'signup-sheet-overlay',
      rendered && !leaving ? 'signup-sheet-overlay-open' : '',
      leaving ? 'signup-sheet-overlay-closing' : '',
    ]"
    @tap="handleClose"
  >
    <view class="signup-sheet-backdrop" />
    <view class="signup-sheet-panel" @tap.stop>
      <view class="signup-sheet-head">
        <view class="signup-sheet-heading">
          <text class="signup-sheet-title">{{ isAdjusting ? "调整报名人数" : "报名散人约球" }}</text>
          <text class="signup-sheet-hint">人数包含自己，可代朋友报名</text>
        </view>
        <button class="signup-sheet-close" aria-label="关闭报名弹窗" @tap="handleClose">×</button>
      </view>

      <view class="signup-sheet-count">
        <view class="signup-sheet-count-label">
          <image class="signup-sheet-icon" src="/static/icons/lucide/users.png" mode="aspectFit" />
          <text>参加人数</text>
        </view>
        <view class="signup-sheet-stepper">
          <wd-input-number
            v-model="count"
            :min="1"
            :max="maxCount"
            :step="1"
            :disabled="submitting"
            integer
            custom-class="signup-count-input"
          />
          <text class="signup-sheet-count-unit">人</text>
        </view>
        <text class="signup-sheet-hint">本次最多可报 {{ maxCount }} 人</text>
      </view>

      <view class="signup-sheet-fee">
        <view class="signup-sheet-fee-caption">
          <text class="signup-sheet-fee-label">报名费用</text>
          <text v-if="feeType === 'offline_aa'" class="signup-sheet-hint">具体费用由组织者线下结算</text>
          <text v-else-if="feePerPersonLabel" class="signup-sheet-hint">{{ feePerPersonLabel }} / 人 × {{ count }} 人</text>
        </view>
        <text class="signup-sheet-fee-total">{{ feeType === "offline_aa" ? "线下 AA" : totalFeeLabel || "免费" }}</text>
      </view>

      <view class="signup-sheet-actions">
        <view class="signup-sheet-primary">
          <AppButton
            block
            variant="dark"
            :loading="submitting"
            :disabled="submitting"
            @click="handleConfirm"
          >
            {{ submitting ? "提交中..." : confirmText }}
          </AppButton>
        </view>
        <view v-if="canCancel" class="signup-sheet-secondary">
          <AppButton block variant="muted" :disabled="submitting" @click="handleCancelRegistration">
            取消报名
          </AppButton>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.signup-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 130;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--ui-motion-overlay-duration) ease;
}

.signup-sheet-overlay-open {
  opacity: 1;
  pointer-events: auto;
}

/* 淡出期间保持点击拦截，退场结束才放行页面（防点穿）。 */
.signup-sheet-overlay-closing {
  opacity: 0;
  pointer-events: auto;
}

.signup-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: var(--ui-color-overlay);
}

.signup-sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  box-sizing: border-box;
  padding: 34rpx 30rpx calc(30rpx + env(safe-area-inset-bottom));
  border-top-left-radius: 36rpx;
  border-top-right-radius: 36rpx;
  background: var(--ui-color-surface);
  transform: translateY(100%);
  transition: transform var(--ui-motion-overlay-duration) var(--ui-motion-ease-out);
}

.signup-sheet-overlay-open .signup-sheet-panel {
  transform: translateY(0);
}

.signup-sheet-overlay-closing .signup-sheet-panel {
  pointer-events: none;
  transform: translateY(100%);
}

/* H5 减少动态效果：弹层直接出现/消失。 */
@media (prefers-reduced-motion: reduce) {
  .signup-sheet-overlay,
  .signup-sheet-panel {
    transition: none;
  }
}

.signup-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.signup-sheet-heading,
.signup-sheet-fee-caption {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}

.signup-sheet-title {
  color: var(--ui-color-text);
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1.4;
}

.signup-sheet-hint {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 1.5;
}

.signup-sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  margin: 0;
  padding: 0;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text-muted);
  font-size: 40rpx;
  line-height: 1;
}

.signup-sheet-close::after { border: 0; }

.signup-sheet-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22rpx;
  margin-top: 28rpx;
  padding: 28rpx 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
}

.signup-sheet-count-label {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 500;
}

.signup-sheet-icon { width: 30rpx; height: 30rpx; }

.signup-sheet-stepper {
  display: flex;
  align-items: center;
  gap: 16rpx;
  --wot-input-number-action-size: 88rpx;
  --wot-input-number-input-height: 88rpx;
  --wot-input-number-input-width: 148rpx;
  --wot-input-number-font-size: 48rpx;
  --wot-input-number-icon-size: 28rpx;
  --wot-input-number-action-border-radius: 20rpx;
  --wot-input-number-action-bg: var(--ui-color-neutral-bg);
  --wot-input-number-input-bg: var(--ui-color-surface);
  --wot-input-number-action-color: var(--ui-color-text);
  --wot-input-number-input-color: var(--ui-color-text);
  --wot-input-number-action-disabled-color: var(--ui-color-line-strong);
  --wot-input-number-action-divider-width: 0;
}

.signup-sheet-count-unit {
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
}

.signup-sheet-fee {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 26rpx 0;
}

.signup-sheet-fee-label {
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
}

.signup-sheet-fee-total {
  color: var(--ui-color-text);
  font-size: 36rpx;
  font-weight: 600;
  flex-shrink: 0;
}

.signup-sheet-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

/* 由原生 view 承担宽度，不依赖样式穿透小程序按钮组件。 */
.signup-sheet-primary,
.signup-sheet-secondary { width: 100%; }
</style>
