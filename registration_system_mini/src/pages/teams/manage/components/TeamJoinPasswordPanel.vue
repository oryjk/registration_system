<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import TeamManagePanel from "./TeamManagePanel.vue";

defineProps<{
  requiresPassword: boolean;
  form: {
    password: string;
  };
  canSubmit: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "submit"): void;
  (event: "clear"): void;
}>();

function handleSubmit() {
  emit("submit");
}

function handleClear() {
  emit("clear");
}
</script>

<template>
  <TeamManagePanel title="入队密码" caption="设置后队员需要输入密码才能加入球队">
    <view class="status-row">
      <text :class="requiresPassword ? 'status-badge status-badge-set' : 'status-badge status-badge-open'">
        {{ requiresPassword ? "已设置入队密码" : "开放加入，无需密码" }}
      </text>
    </view>
    <view class="form-field">
      <text class="form-label">新密码</text>
      <input
        v-model="form.password"
        class="form-input"
        placeholder="输入新密码，留空提交不修改"
        password
      />
    </view>
    <view class="form-actions">
    <AppButton icon="lock" block :disabled="!canSubmit" :loading="submitting" @click="handleSubmit">
      {{ submitting ? "保存中..." : "保存入队密码" }}
    </AppButton>
    <AppButton
      v-if="requiresPassword"
      block
      variant="outline"
      custom-class="clear-button"
      :disabled="!canSubmit"
      @click="handleClear"
    >
      清除密码（开放加入）
    </AppButton>
    </view>
  </TeamManagePanel>
</template>

<style scoped>
@import "@/styles/form-controls.css";

.form-field {
  margin-top: 26rpx;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 600;
}

.status-row {
  margin-top: 22rpx;
}

.status-badge {
  display: inline-block;
  padding: 8rpx 14rpx;
  border: none;
  border-radius: var(--ui-radius-round);
  font-size: 24rpx;
  font-weight: 600;
}

.status-badge-set {
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
}

.status-badge-open {
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-fg);
}

.form-actions { display: flex; flex-direction: column; gap: 16rpx; margin-top: 28rpx; }
</style>
