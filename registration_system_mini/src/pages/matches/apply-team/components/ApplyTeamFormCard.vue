<script setup lang="ts">
import AppSurface from "@/components/ui/AppSurface.vue";

defineProps<{
  teamName: string;
  introduction: string;
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (event: "update:introduction", value: string): void;
  (event: "submit"): void;
}>();
</script>

<template>
  <AppSurface variant="raised">
    <view class="form-row">
      <text class="form-label">我的球队</text>
      <text class="form-team">{{ teamName }}</text>
    </view>

    <view class="form-field">
      <text class="form-label">球队介绍</text>
      <textarea
        class="form-textarea"
        :value="introduction"
        placeholder="向对方球队介绍一下：平均水平、每周场次、联系人等"
        :maxlength="200"
        @input="emit('update:introduction', ($event as any).detail.value)"
      />
      <text class="form-counter">{{ introduction.length }}/200</text>
    </view>

    <view
      :class="['form-submit', isSubmitting ? 'form-submit-disabled' : '']"
      @tap="!isSubmitting && emit('submit')"
    >
      {{ isSubmitting ? "提交中..." : "确认接约" }}
    </view>
  </AppSurface>
</template>

<style scoped>
.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.form-label {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--ui-color-text);
}

.form-team {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ui-color-text);
}

.form-field {
  position: relative;
  margin-top: 24rpx;
}

.form-textarea {
  width: 100%;
  min-height: 180rpx;
  margin-top: 14rpx;
  padding: 18rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--ui-color-text);
  box-sizing: border-box;
}

.form-counter {
  position: absolute;
  right: 6rpx;
  bottom: -34rpx;
  font-size: 20rpx;
  font-weight: 400;
  color: var(--ui-color-text-disabled);
}

.form-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 52rpx;
  height: 84rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-text);
  color: var(--ui-color-text-inverse);
  font-size: 30rpx;
  font-weight: 600;
  box-shadow: var(--ui-shadow-card);
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out);
}

.form-submit:active {
  transform: scale(0.98);
}

.form-submit-disabled {
  opacity: 0.6;
}
</style>
