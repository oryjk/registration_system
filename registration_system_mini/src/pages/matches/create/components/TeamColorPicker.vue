<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: string;
    colorOptions?: { name: string; value: string }[];
  }>(),
  {
    colorOptions: () => [
      { name: "深蓝", value: "#2F6BFF" },
      { name: "荧光绿", value: "#C8FF00" },
      { name: "橙红", value: "#FF6B35" },
      { name: "紫红", value: "#B34DFF" },
      { name: "墨黑", value: "#111310" },
      { name: "白银", value: "#D8DDE6" },
    ],
  },
);

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

function select(value: string) {
  if (value !== props.modelValue) {
    emit("update:modelValue", value);
  }
}
</script>

<template>
  <view class="color-field">
    <text class="form-label">{{ label }}</text>
    <view class="color-select-grid">
      <view
        v-for="option in colorOptions"
        :key="option.value"
        :class="['color-option', modelValue === option.value ? 'color-option-active' : '']"
        role="button"
        :aria-label="label + '：' + option.name"
        :aria-pressed="modelValue === option.value"
        hover-class="color-option--pressed"
        @tap="select(option.value)"
      >
        <view class="color-swatch" :style="{ backgroundColor: option.value }" />
        <text class="color-option-text">{{ option.name }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.color-field {
  margin-top: 26rpx;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 600;
}

.color-select-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6rpx;
}

.color-option {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
  min-height: 84rpx;
  padding: 10rpx 2rpx;
  border: 0;
  border-radius: var(--ui-radius-button);
  background: transparent;
  box-sizing: border-box;
}

.color-option-active {
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-text);
}

.color-swatch {
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(17, 19, 16, 0.18);
  flex-shrink: 0;
}

.color-option-text {
  min-width: 0;
  font-size: 20rpx;
  font-weight: 500;
  color: var(--ui-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.color-option--pressed { opacity: 0.7; }
</style>
