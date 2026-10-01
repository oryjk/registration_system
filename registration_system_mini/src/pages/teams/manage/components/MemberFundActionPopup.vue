<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
const { themePageStyle } = useAccentTheme();
import { computed } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import type { BackendTeamMember } from "@/types/backend";

const props = defineProps<{
  modelValue: boolean;
  /** recharge=充值登记（入账并自动标记会员）；consume=消费扣费（需填原因）。 */
  mode: "recharge" | "consume";
  member: BackendTeamMember | null;
  memberName: string;
  form: {
    amountYuan: string;
    note: string;
  };
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "close"): void;
  (event: "submit"): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

const title = computed(() =>
  props.mode === "recharge" ? "队费充值" : "消费扣费",
);

const submitLabel = computed(() =>
  props.submitting ? "提交中..." : props.mode === "recharge" ? "确认充值" : "确认扣费",
);

const noteLabel = computed(() =>
  props.mode === "recharge" ? "备注（可选）" : "消费原因（必填）",
);

function handleClose() {
  emit("close");
}

function handleSubmit() {
  emit("submit");
}

function yuanLabel(cents: number) {
  return (Math.abs(cents) / 100).toFixed(2);
}
</script>

<template>
  <wd-popup
    :custom-style="themePageStyle"
    v-model="visible"
    position="bottom"
    custom-class="member-fund-popup"
    :close-on-click-modal="!submitting"
    safe-area-inset-bottom
    root-portal
    @close="handleClose"
  >
    <view class="app-theme-scope member-fund-sheet" :style="themePageStyle">
      <view class="member-fund-header">
        <view>
          <text class="member-fund-kicker">{{ title }}</text>
          <text class="member-fund-title">{{ member ? memberName : "队员" }}</text>
        </view>
        <AppButton variant="outline" size="sm" @click="handleClose">取消</AppButton>
      </view>

      <view v-if="member" class="member-fund-balance">
        <text class="member-fund-balance-label">当前队费余额</text>
        <text :class="(member.balance_cents ?? 0) < 0 ? 'member-fund-debt' : 'member-fund-amount'">
          {{ (member.balance_cents ?? 0) < 0 ? `欠款 ¥${yuanLabel(member.balance_cents ?? 0)}` : `¥${yuanLabel(member.balance_cents ?? 0)}` }}
        </text>
      </view>
      <text v-if="member && (member.balance_cents ?? 0) < 0" class="member-fund-hint">
        {{ mode === "recharge" ? "充值将优先抵扣欠款" : "余额不足时将记为欠款（负数）" }}
      </text>

      <view class="member-fund-field">
        <text class="member-fund-label">金额（元）</text>
        <input
          v-model="form.amountYuan"
          class="member-fund-input"
          type="digit"
          placeholder="例如 100"
        />
      </view>
      <view class="member-fund-field">
        <text class="member-fund-label">{{ noteLabel }}</text>
        <input
          v-model="form.note"
          class="member-fund-input"
          :placeholder="mode === 'recharge' ? '例如：线下现金收款' : '例如：购买队服'"
          maxlength="40"
        />
      </view>

      <AppButton icon="check" block :loading="submitting" @click="handleSubmit">
        {{ submitLabel }}
      </AppButton>
    </view>
  </wd-popup>
</template>

<style scoped>
:deep(.member-fund-popup) {
  border-top: var(--ui-border-default);
  border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
  background: var(--ui-color-surface);
}

.member-fund-sheet {
  padding: 34rpx 30rpx 38rpx;
  background: var(--ui-color-surface);
  border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.member-fund-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.member-fund-kicker {
  display: block;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 500;
}

.member-fund-title {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-color-text);
  font-size: 38rpx;
  font-weight: 600;
}

.member-fund-balance {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.member-fund-balance-label,
.member-fund-label {
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.member-fund-amount,
.member-fund-debt {
  font-size: 28rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.member-fund-amount {
  color: var(--ui-color-text);
}

.member-fund-debt {
  color: var(--ui-color-danger-fg);
}

.member-fund-hint {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
}

.member-fund-field {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.member-fund-input {
  height: 84rpx;
  padding: 0 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-sm);
  background: var(--ui-color-page);
  color: var(--ui-color-text);
  font-size: 28rpx;
}
</style>
