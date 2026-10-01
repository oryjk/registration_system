<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
const { themePageStyle } = useAccentTheme();
import { computed, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import type { BackendTeamMember } from "@/types/backend";
import { memberRoleOptions, roleLabel } from "../teamManageState";

const props = defineProps<{
  modelValue: boolean;
  member: BackendTeamMember | null;
  memberName: string;
  form: {
    role: string;
    isPaidMember: boolean;
  };
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "close"): void;
  (event: "submit"): void;
  (event: "recharge"): void;
  (event: "consume"): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

function handleClose() {
  emit("close");
}

function handleSubmit() {
  emit("submit");
}

const roleModel = computed({
  get: () => [props.form.role],
  set: (value) => {
    props.form.role = String(value[0] || "member");
  },
});
const rolePickerVisible = ref(false);

function yuanLabel(cents: number) {
  return (Math.abs(cents) / 100).toFixed(2);
}

const balanceLabel = computed(() => {
  const cents = props.member?.balance_cents ?? 0;
  return cents < 0 ? `欠款 ¥${yuanLabel(cents)}` : `¥${yuanLabel(cents)}`;
});

const balanceToneClass = computed(() =>
  (props.member?.balance_cents ?? 0) < 0 ? "member-balance-debt" : "member-balance-amount",
);

const lastRechargeLabel = computed(() => {
  const value = props.member?.last_recharge_at;
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
});

function handlePaidMemberChange(event: Event) {
  props.form.isPaidMember = !!(event as Event & { detail?: { value?: boolean } }).detail?.value;
}
</script>

<template>
  <wd-popup
    :custom-style="themePageStyle"
    v-model="visible"
    position="bottom"
    custom-class="member-edit-popup"
    :close-on-click-modal="!submitting"
    safe-area-inset-bottom
    root-portal
    @close="handleClose"
  >
    <view class="app-theme-scope member-edit-sheet" :style="themePageStyle">
      <view class="member-edit-header">
        <view>
          <text class="member-edit-kicker">编辑队员</text>
          <text class="member-edit-title">{{ member ? memberName : "队员" }}</text>
        </view>
        <AppButton variant="outline" size="sm" @click="handleClose">取消</AppButton>
      </view>
      <template v-if="member?.role === 'captain'">
        <view class="member-readonly-field">
          <text class="member-readonly-label">队员角色</text>
          <text class="member-readonly-value">队长</text>
        </view>
      </template>
      <template v-else>
        <wd-cell
          title="队员角色"
          :value="roleLabel(form.role)"
          is-link
          clickable
          custom-class="member-role-cell"
          custom-title-class="member-role-cell-title"
          custom-value-class="member-role-cell-value"
          @click="rolePickerVisible = true"
        />
        <wd-picker
          v-model="roleModel"
          v-model:visible="rolePickerVisible"
          title="选择角色"
          placeholder="请选择角色"
          :columns="memberRoleOptions.filter((option) => option.value !== 'captain')"
          value-key="value"
          label-key="label"
          confirm-button-text="确定"
          cancel-button-text="取消"
          custom-class="member-role-picker"
          custom-cell-class="member-role-picker-cell"
          custom-value-class="member-role-picker-value"
        />
      </template>

      <view class="member-finance-section">
        <view class="member-finance-row">
          <view class="member-finance-copy">
            <text class="member-finance-label">付费会员</text>
            <text class="member-finance-hint">充值到账会自动标记为会员</text>
          </view>
          <switch :checked="form.isPaidMember" @change="handlePaidMemberChange" />
        </view>

        <view class="member-finance-readonly">
          <view class="member-finance-readonly-row">
            <text class="member-finance-label">当前队费余额</text>
            <text :class="balanceToneClass">{{ balanceLabel }}</text>
          </view>
          <view class="member-finance-readonly-row">
            <text class="member-finance-label">最近充值</text>
            <text class="member-finance-value">{{ lastRechargeLabel }}</text>
          </view>
          <text class="member-finance-hint">余额由充值与消费扣费产生，不能直接修改</text>
        </view>

        <view class="member-finance-actions">
          <AppButton variant="outline" size="sm" icon="add" :disabled="submitting" @click="emit('recharge')">
            充值
          </AppButton>
          <AppButton variant="outline" size="sm" icon="minus" :disabled="submitting" @click="emit('consume')">
            消费扣费
          </AppButton>
        </view>
      </view>

      <AppButton icon="check" block :loading="submitting" @click="handleSubmit">
        {{ submitting ? "保存中..." : "保存队员" }}
      </AppButton>
    </view>
  </wd-popup>
</template>

<style scoped>
:deep(.member-edit-popup) {
  border-top: var(--ui-border-default);
  border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
  background: var(--ui-color-surface);
}

.member-edit-sheet {
  padding: 34rpx 30rpx 38rpx;
  background: var(--ui-color-surface);
  border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
}

.member-edit-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.member-edit-kicker {
  display: block;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 500;
}

.member-edit-title {
  display: block;
  margin-top: 8rpx;
  color: var(--ui-color-text);
  font-size: 38rpx;
  font-weight: 600;
}

.member-readonly-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
}

.member-readonly-label {
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
}

.member-readonly-value {
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.member-finance-section {
  margin-top: 10rpx;
  padding: 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-sm);
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.member-finance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.member-finance-copy {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.member-finance-label {
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.member-finance-hint {
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
}

.member-finance-value {
  color: var(--ui-color-text);
  font-size: 26rpx;
}

.member-finance-readonly {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.member-finance-readonly-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.member-balance-amount {
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.member-balance-debt {
  color: var(--ui-color-danger-fg);
  font-size: 28rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.member-finance-actions {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}
</style>
