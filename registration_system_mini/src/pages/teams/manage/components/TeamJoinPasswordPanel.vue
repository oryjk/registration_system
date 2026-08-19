<script setup lang="ts">
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";

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
  <NeoSurface custom-class="form-card">
    <NeoSectionHeader title="入队密码" marker="02" caption="设置后队员需要输入密码才能加入球队" />
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
    <NeoButton block :disabled="!canSubmit" :loading="submitting" @click="handleSubmit">
      {{ submitting ? "保存中..." : "保存入队密码" }}
    </NeoButton>
    <NeoButton
      v-if="requiresPassword"
      block
      variant="outline"
      custom-class="clear-button"
      :disabled="!canSubmit"
      @click="handleClear"
    >
      清除密码（开放加入）
    </NeoButton>
  </NeoSurface>
</template>

<style scoped>
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-text);
}

.form-field {
  margin-top: 26rpx;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.form-input {
  width: 100%;
  height: 84rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.status-row {
  margin-top: 22rpx;
}

.status-badge {
  display: inline-block;
  padding: 8rpx 14rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  font-size: 24rpx;
  font-weight: 900;
}

.status-badge-set {
  background: var(--neo-color-info-soft);
  color: var(--neo-color-text);
}

.status-badge-open {
  background: var(--neo-color-success);
  color: var(--neo-color-text);
}

:deep(.neo-button--block) {
  margin-top: 26rpx;
}

:deep(.clear-button.neo-button--block) {
  margin-top: 16rpx;
}
</style>
