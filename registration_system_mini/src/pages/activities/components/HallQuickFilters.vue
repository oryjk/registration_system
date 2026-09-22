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
        hover-class="hall-filter-chip--pressed"
        :hover-stay-time="100"
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
        hover-class="hall-filter-chip--pressed"
        :hover-stay-time="100"
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
  border: 2rpx solid var(--ui-color-line);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-surface);
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 500;
  box-sizing: border-box;
  transition: background-color var(--ui-motion-switch-duration) var(--ui-motion-ease-out), color var(--ui-motion-switch-duration) var(--ui-motion-ease-out), border-color var(--ui-motion-switch-duration) var(--ui-motion-ease-out), opacity var(--ui-motion-press-duration) ease;
}

.hall-filter-chip-size {
  min-width: 88rpx;
  height: 48rpx;
  padding: 0 16rpx;
  font-size: 22rpx;
}

/* 选中态：墨底反白，颜色平滑过渡而非瞬间换色。 */
.hall-filter-chip-active {
  border-color: var(--ui-color-text);
  background: var(--ui-color-text);
  color: var(--ui-color-text-inverse);
  font-weight: 600;
}

.hall-filter-chip--pressed {
  opacity: 0.72;
}
</style>
