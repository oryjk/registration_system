<script setup lang="ts">
import type { HallMatchKindFilter, HallMatchSizeFilter } from "../hallMatchState";

defineProps<{
  activeKind: HallMatchKindFilter;
  activeSize: HallMatchSizeFilter;
}>();

const emit = defineEmits<{
  (event: "selectKind", kind: HallMatchKindFilter): void;
  (event: "selectSize", size: HallMatchSizeFilter): void;
}>();

const kindFilters: Array<{ key: HallMatchKindFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "team", label: "球队约队" },
  { key: "individual", label: "散人约局" },
  { key: "mine", label: "我相关" },
];

const sizeFilters: Array<{ key: HallMatchSizeFilter; label: string }> = [
  { key: 0, label: "不限人数" },
  { key: 8, label: "8 人制" },
  { key: 5, label: "5 人制" },
];
</script>

<template>
  <view class="hall-filters">
    <view class="hall-filters-row">
      <view
        v-for="filter in kindFilters"
        :key="filter.key"
        :class="['hall-filter-chip', activeKind === filter.key ? 'hall-filter-chip-active' : '']"
        @tap="emit('selectKind', filter.key)"
      >
        {{ filter.label }}
      </view>
    </view>

    <view class="hall-filters-row">
      <view
        v-for="filter in sizeFilters"
        :key="filter.key"
        :class="['hall-filter-chip', 'hall-filter-chip-size', activeSize === filter.key ? 'hall-filter-chip-active' : '']"
        @tap="emit('selectSize', filter.key)"
      >
        {{ filter.label }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.hall-filters {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.hall-filters-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.hall-filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 104rpx;
  height: 56rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 800;
  transition: transform var(--neo-motion-fast), box-shadow var(--neo-motion-fast);
}

.hall-filter-chip-size {
  min-width: 88rpx;
  height: 48rpx;
  padding: 0 16rpx;
  font-size: 22rpx;
}

.hall-filter-chip-active {
  background: var(--neo-color-text);
  color: var(--neo-color-text-inverse);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-accent);
}
</style>
