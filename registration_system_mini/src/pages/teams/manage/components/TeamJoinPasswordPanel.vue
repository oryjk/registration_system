<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import AppSurface from "@/components/ui/AppSurface.vue";

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
  <AppSurface custom-class="form-card">
    <SectionHeader title="入队密码" caption="设置后队员需要输入密码才能加入球队" />
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
  </AppSurface>
</template>

<style scoped>
@import "@/styles/form-controls.css";
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  box-shadow: none;
}

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
  border-radius: var(--ui-radius-xs);
  font-size: 24rpx;
  font-weight: 600;
}

.status-badge-set {
  background: var(--ui-color-info-soft);
  color: var(--ui-color-text);
}

.status-badge-open {
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-fg);
}

:deep(.ui-button--block) {
  margin-top: 26rpx;
}

:deep(.clear-button.ui-button--block) {
  margin-top: 16rpx;
}
</style>
