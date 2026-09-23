<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
defineProps<{ modelValue: string; placeholder?: string; loading?: boolean }>();
const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "search"): void;
  (event: "clear"): void;
}>();
function updateInput(event: Event) {
  const value = (event as Event & { detail?: { value?: string } }).detail?.value ?? "";
  emit("update:modelValue", value);
  if (!value) emit("clear");
}
</script>

<template>
  <view class="hall-search-row">
    <view class="hall-search-field">
      <wd-icon name="search-line" size="30rpx" color="var(--ui-color-text-muted)" />
      <input :value="modelValue" class="hall-search-input" :placeholder="placeholder || '搜索比赛名称或地点'" placeholder-class="hall-search-placeholder" confirm-type="search" @input="updateInput" @confirm="emit('search')" />
      <button v-if="modelValue" class="hall-search-clear" aria-label="清空搜索" @tap="emit('clear')"><wd-icon name="close" size="26rpx" /></button>
    </view>
    <view class="hall-search-submit"><AppButton variant="lime" :loading="loading" @click="emit('search')">搜索</AppButton></view>
  </view>
</template>

<style scoped>
.hall-search-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 24rpx; width: 100%; }
.hall-search-field { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12rpx; height: 88rpx; padding: 0 16rpx 0 20rpx; border: var(--ui-border-default); border-radius: var(--ui-radius-button); background: var(--ui-color-surface); box-sizing: border-box; }
.hall-search-input { flex: 1; min-width: 0; height: 100%; color: var(--ui-color-text); font-size: 26rpx; }
.hall-search-placeholder { color: var(--ui-color-text-disabled); }
.hall-search-clear { flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0; width: 52rpx; height: 64rpx; background: transparent; color: var(--ui-color-text-muted); }
.hall-search-clear::after { border: 0; }
.hall-search-submit { flex-shrink: 0; }
</style>
