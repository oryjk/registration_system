<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
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
    <view class="hall-search-field ui-subtle-control">
      <!-- #ifdef MP-WEIXIN -->
      <AppIcon name="search" size="var(--ui-icon-md)" tone="muted" />
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <wd-icon name="search-line" size="30rpx" color="var(--ui-color-text-muted)" />
      <!-- #endif -->
      <input :value="modelValue" class="hall-search-input" :placeholder="placeholder || '搜索比赛名称或地点'" placeholder-class="hall-search-placeholder" confirm-type="search" @input="updateInput" @confirm="emit('search')" />
      <button v-if="modelValue" class="hall-search-clear" aria-label="清空搜索" @tap="emit('clear')"><!-- #ifdef MP-WEIXIN -->
<AppIcon name="x" size="var(--ui-icon-xs)" tone="muted" />
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<wd-icon name="close" size="26rpx" />
<!-- #endif --></button>
    </view>
    <view class="hall-search-submit"><AppButton variant="lime" :loading="loading" @click="emit('search')">搜索</AppButton></view>
  </view>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
.hall-search-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 24rpx; width: 100%; }
.hall-search-field { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12rpx; height: 88rpx; padding: 0 16rpx 0 20rpx; border: var(--ui-border-default); border-radius: var(--ui-radius-button); background: var(--ui-color-surface); box-sizing: border-box; }
.hall-search-input { flex: 1; min-width: 0; height: 100%; color: var(--ui-color-text); font-size: 26rpx; }
.hall-search-placeholder { color: var(--ui-color-text-disabled); }
.hall-search-clear { flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin: 0; padding: 0; width: 52rpx; height: 64rpx; background: transparent; color: var(--ui-color-text-muted); }
.hall-search-clear::after { border: 0; }
.hall-search-submit { flex-shrink: 0; }

/* #ifdef MP-WEIXIN */
.hall-search-row { padding: 0; border: var(--ui-panel-border); border-radius: 0; background: transparent; box-shadow: none; box-sizing: border-box; gap: var(--ui-space-4); margin-bottom: var(--ui-card-gap); }
.hall-search-field { border: var(--ui-input-border); border-radius: var(--ui-input-radius); background: var(--ui-card-bg); height: var(--ui-input-height); padding: 0 var(--ui-input-padding); gap: var(--ui-space-3); }
.hall-search-clear { width: var(--ui-control-min-height); height: var(--ui-control-min-height); }
.hall-search-input { font-size: var(--ui-text-label); }
/* #endif */
</style>
