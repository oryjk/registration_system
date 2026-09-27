<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: string;
    colorOptions?: { name: string; value: string }[];
  }>(),
  {
    colorOptions: () => [
      { name: "白色", value: "#FFFFFF" },
      { name: "绿色", value: "#22C55E" },
      { name: "红色", value: "#EF4444" },
      { name: "蓝色", value: "#2F6BFF" },
      { name: "黑色", value: "#111310" },
      { name: "黄色", value: "#FACC15" },
      { name: "橙色", value: "#FF6B35" },
      { name: "紫色", value: "#B34DFF" },
      { name: "粉色", value: "#EC4899" },
      { name: "青色", value: "#06B6D4" },
      { name: "天蓝", value: "#38BDF8" },
      { name: "荧光绿", value: "#C8FF00" },
      { name: "银灰", value: "#D8DDE6" },
      { name: "灰色", value: "#94A3B8" },
    ],
  },
);

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

const selectedColorName = computed(() => (
  props.colorOptions.find((option) => option.value.toLowerCase() === props.modelValue.trim().toLowerCase())?.name ?? ""
));

function select(value: string) {
  if (value !== props.modelValue) {
    emit("update:modelValue", value);
  }
}
</script>

<template>
  <view class="color-field">
    <text class="form-label">{{ label }}<text v-if="selectedColorName">：{{ selectedColorName }}</text></text>
    <scroll-view class="color-scroll" scroll-x :show-scrollbar="false">
      <view class="color-select-row">
        <view
          v-for="option in colorOptions"
          :key="option.value"
          :class="['color-option', modelValue === option.value ? 'color-option-active' : '']"
          role="button"
          :aria-label="label + '：' + option.name"
          :aria-pressed="modelValue === option.value"
          hover-class="color-option--pressed"
          @tap="select(option.value)"
          :style="{ backgroundColor: option.value }"
        >
          <view v-if="modelValue === option.value" class="color-option-check" aria-hidden="true">
            <text>✓</text>
          </view>
        </view>
      </view>
    </scroll-view>
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

.color-scroll {
  width: 100%;
  overflow: hidden;
}

.color-select-row {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12rpx;
  padding: 6rpx 10rpx 10rpx 2rpx;
  box-sizing: border-box;
}

.color-option {
  position: relative;
  flex: 0 0 92rpx;
  width: 92rpx;
  height: 76rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 16rpx;
  box-sizing: border-box;
  overflow: hidden;
  box-shadow: var(--ui-shadow-soft);
  transition:
    transform var(--ui-motion-press-duration) var(--ui-motion-ease-out),
    opacity var(--ui-motion-press-duration) ease;
}

.color-option-active {
  z-index: 1;
  transform: scale(1.08);
}

.color-option-check {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28rpx;
  height: 28rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1;
  box-shadow: var(--ui-shadow-soft);
}

.color-option--pressed {
  transform: scale(0.92);
  opacity: 0.82;
}
</style>
