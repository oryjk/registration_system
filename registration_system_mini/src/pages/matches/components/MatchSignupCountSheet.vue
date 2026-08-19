<script setup lang="ts">
import { computed, ref, watch } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";

const props = defineProps<{
  visible: boolean;
  /** 可报人数上限（剩余名额，调整人数时含本人当前占用）。 */
  maxCount: number;
  /** 当前已报人数（调整时预填）。 */
  currentCount: number;
  /** 人均费用标签（如 ¥25.00）；空串表示免费。 */
  feePerPersonLabel?: string;
  submitting?: boolean;
  /** 已报名未支付时展示「取消报名」次按钮。 */
  canCancel?: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "confirm", count: number): void;
  (event: "cancelRegistration"): void;
}>();

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

function handleConfirm() {
  if (!props.submitting) emit("confirm", count.value);
}

function handleCancelRegistration() {
  if (!props.submitting) emit("cancelRegistration");
}
</script>

<template>
  <view :class="['signup-sheet-overlay', visible ? 'signup-sheet-overlay-open' : '']" @tap="emit('close')">
    <view class="signup-sheet-backdrop" />
    <view class="signup-sheet-panel" @tap.stop>
      <view class="signup-sheet-head">
        <text class="signup-sheet-title">报名人数</text>
        <text class="signup-sheet-hint">最多可报 {{ maxCount }} 人（含自己）</text>
      </view>

      <view class="signup-sheet-count">
        <wd-input-number
          v-model="count"
          :min="1"
          :max="maxCount"
          :step="1"
          integer
          custom-class="signup-count-input"
        />
        <text class="signup-sheet-count-unit">人</text>
      </view>

      <view class="signup-sheet-fee">
        <text class="signup-sheet-fee-label">{{ feePerPersonLabel ? `人均 ${feePerPersonLabel}` : "免费报名" }}</text>
        <text v-if="totalFeeLabel" class="signup-sheet-fee-total">合计 {{ totalFeeLabel }}</text>
      </view>

      <view class="signup-sheet-actions">
        <NeoButton
          v-if="canCancel"
          variant="muted"
          :disabled="submitting"
          @click="handleCancelRegistration"
        >
          取消报名
        </NeoButton>
        <NeoButton
          class="signup-sheet-confirm"
          variant="dark"
          :loading="submitting"
          :disabled="submitting"
          @click="handleConfirm"
        >
          {{ submitting ? "提交中..." : confirmText }}
        </NeoButton>
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
  transition: opacity 240ms ease;
}

.signup-sheet-overlay-open {
  opacity: 1;
  pointer-events: auto;
}

.signup-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: var(--neo-color-overlay);
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
  background: var(--neo-color-surface, #ffffff);
  transform: translateY(100%);
  transition: transform 240ms ease;
}

.signup-sheet-overlay-open .signup-sheet-panel {
  transform: translateY(0);
}

.signup-sheet-head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.signup-sheet-title {
  color: var(--neo-color-text);
  font-size: 36rpx;
  font-weight: 900;
}

.signup-sheet-hint {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
}

.signup-sheet-count {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 28rpx;
  padding: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-warning-soft);
}

.signup-sheet-count-unit {
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.signup-sheet-fee {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 20rpx;
}

.signup-sheet-fee-label {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
}

.signup-sheet-fee-total {
  color: var(--neo-color-text);
  font-size: 34rpx;
  font-weight: 900;
}

.signup-sheet-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}

.signup-sheet-actions .signup-sheet-confirm {
  flex: 1;
}
</style>
