<script setup lang="ts">
import { computed, ref } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import type { BackendTeamMember } from "@/types/backend";
import { memberRoleOptions, roleLabel } from "../teamManageState";

const props = defineProps<{
  modelValue: boolean;
  member: BackendTeamMember | null;
  memberName: string;
  form: {
    role: string;
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
  set: (value) => emit("update:modelValue", value),
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
</script>

<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    custom-class="member-edit-popup"
    :close-on-click-modal="!submitting"
    safe-area-inset-bottom
    root-portal
    @close="handleClose"
  >
    <view class="member-edit-sheet">
      <view class="member-edit-header">
        <view>
          <text class="member-edit-kicker">编辑队员</text>
          <text class="member-edit-title">{{ member ? memberName : "队员" }}</text>
        </view>
        <NeoButton variant="outline" size="sm" @click="handleClose">取消</NeoButton>
      </view>

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
        :columns="memberRoleOptions"
        value-key="value"
        label-key="label"
        confirm-button-text="确定"
        cancel-button-text="取消"
        custom-class="member-role-picker"
        custom-cell-class="member-role-picker-cell"
        custom-value-class="member-role-picker-value"
      />

      <!-- Go 队员模型只有 role/status：球衣号与队员会员开关已随 legacy Rust 字段一起移除。 -->
      <NeoButton block :loading="submitting" @click="handleSubmit">
        {{ submitting ? "保存中..." : "保存队员" }}
      </NeoButton>
    </view>
  </wd-popup>
</template>

<style scoped>
:deep(.member-edit-popup) {
  border-top: var(--neo-border-strong);
  border-radius: var(--neo-radius-md) var(--neo-radius-md) 0 0;
  background: var(--neo-color-page);
}

.member-edit-sheet {
  padding: 34rpx 30rpx 38rpx;
  background: var(--neo-color-page);
  border-radius: var(--neo-radius-md) var(--neo-radius-md) 0 0;
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
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 800;
}

.member-edit-title {
  display: block;
  margin-top: 8rpx;
  color: var(--neo-color-text);
  font-size: 38rpx;
  font-weight: 900;
}

.member-role-picker {
  width: 100%;
  display: block;
  margin-top: 14rpx;
}

:deep(.member-role-picker) {
  --wot-picker-bg: var(--neo-color-surface);
  --wot-picker-action-color-confirm: var(--neo-color-text);
  --wot-picker-action-color-cancel: var(--neo-color-text-muted);
  --wot-picker-action-disabled-color: var(--neo-color-text-disabled);
  --wot-picker-title-color: var(--neo-color-text);
  --wot-picker-title-font-weight: 900;
  --wot-picker-radius: var(--neo-radius-md);
}

:deep(.member-role-cell) {
  margin-top: 14rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  box-sizing: border-box;
}

:deep(.member-role-cell-title) {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 900;
}

:deep(.member-role-cell-value) {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

:deep(.member-role-picker-cell) {
  width: 100%;
  height: 84rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  box-sizing: border-box;
}

:deep(.member-role-picker-value) {
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 900;
}

:deep(.member-edit-sheet .neo-button--block) {
  margin-top: 28rpx;
}
</style>
