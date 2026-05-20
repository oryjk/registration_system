<script setup lang="ts">
import { computed } from "vue";
import type { BackendTeamMember } from "@/types/backend";
import { memberRoleOptions } from "../teamManageState";

const props = defineProps<{
  modelValue: boolean;
  member: BackendTeamMember | null;
  memberName: string;
  form: {
    role: string;
    jerseyNumber: string;
    isMember: boolean;
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

function handleMemberSwitchChange(event: Event) {
  const detail = (event as unknown as { detail?: { value?: boolean } }).detail;
  props.form.isMember = !!detail?.value;
}

const roleModel = computed({
  get: () => [props.form.role],
  set: (value) => {
    props.form.role = String(value[0] || "member");
  },
});
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
        <view class="member-edit-close" @tap="handleClose">取消</view>
      </view>

      <wd-picker
        v-model="roleModel"
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

      <input v-model="form.jerseyNumber" class="form-input member-edit-input" placeholder="球衣号，可选" />
      <view class="member-setting-row">
        <view>
          <text class="member-setting-title">队员会员</text>
          <text class="member-setting-copy">保存后会显示在队员信息里</text>
        </view>
        <switch :checked="form.isMember" color="#c8ff00" @change="handleMemberSwitchChange" />
      </view>
      <view class="primary-button" @tap="handleSubmit">
        {{ submitting ? "保存中..." : "保存队员" }}
      </view>
    </view>
  </wd-popup>
</template>

<style scoped>
:deep(.member-edit-popup) {
  border-radius: 34rpx 34rpx 0 0;
  background: #ffffff;
}

.member-edit-sheet {
  padding: 34rpx 30rpx 38rpx;
  background: #ffffff;
  border-radius: 34rpx 34rpx 0 0;
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
  color: #6a7165;
  font-size: 24rpx;
  font-weight: 800;
}

.member-edit-title {
  display: block;
  margin-top: 8rpx;
  color: #10110f;
  font-size: 38rpx;
  font-weight: 900;
}

.member-edit-close {
  height: 58rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #edf0e7;
  color: #5d6458;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.member-role-picker {
  width: 100%;
  display: block;
  margin-top: 14rpx;
}

:deep(.member-role-picker-cell) {
  width: 100%;
  height: 86rpx;
  padding: 0 22rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  color: #111310;
  box-sizing: border-box;
}

:deep(.member-role-picker-value) {
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
}

.form-input {
  width: 100%;
  height: 86rpx;
  padding: 0 22rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  color: #111310;
  font-size: 28rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.member-edit-input {
  margin-top: 14rpx;
}

.member-setting-row {
  min-height: 88rpx;
  margin-top: 14rpx;
  padding: 16rpx 18rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  box-sizing: border-box;
}

.member-setting-title,
.member-setting-copy {
  display: block;
}

.member-setting-title {
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
}

.member-setting-copy {
  margin-top: 4rpx;
  color: #6a7165;
  font-size: 22rpx;
  font-weight: 700;
}

.primary-button {
  height: 88rpx;
  margin-top: 28rpx;
  border-radius: 24rpx;
  background: #c8ff00;
  color: #10110f;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 900;
}
</style>
