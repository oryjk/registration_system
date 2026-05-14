<script setup lang="ts">
import { computed } from "vue";

export type ActivityQuickFilter = "recommended" | "team" | "individual" | "mine" | "open" | "eight" | "five";

const props = defineProps<{
  searchDraft: string;
  quickFilters: Array<{ key: ActivityQuickFilter; label: string }>;
  activeQuickFilter: ActivityQuickFilter;
  calendarDays: Array<{
    key: string;
    badgeLabel: string;
    dayNumber: string;
    matchCount: number;
  }>;
  selectedDateKey: string;
  canPublish: boolean;
}>();

const emit = defineEmits<{
  (event: "update:searchDraft", value: string): void;
  (event: "search"): void;
  (event: "quickFilter", value: ActivityQuickFilter): void;
  (event: "selectDate", value: string): void;
  (event: "openPublish"): void;
}>();

const searchDraftModel = computed({
  get: () => props.searchDraft,
  set: (value) => emit("update:searchDraft", value),
});

function handleSearch() {
  emit("search");
}

function handleQuickFilter(filter: ActivityQuickFilter) {
  emit("quickFilter", filter);
}

function handleSelectDate(key: string) {
  emit("selectDate", key);
}

function handleOpenPublish() {
  emit("openPublish");
}
</script>

<template>
  <view>
    <view class="hall-toolbar">
      <view class="hall-search">
        <text class="hall-search-icon">搜</text>
        <input
          v-model="searchDraftModel"
          class="hall-search-input"
          placeholder="搜索球队 / 场地 / 比赛"
          confirm-type="search"
          @confirm="handleSearch"
        />
      </view>
      <view
        :class="['hall-publish-button', !canPublish ? 'hall-publish-button-disabled' : '']"
        @tap="handleOpenPublish"
      >
        发布约队
      </view>
    </view>

    <view class="hall-quick-filters">
      <view
        v-for="item in quickFilters"
        :key="item.key"
        :class="['hall-quick-chip', activeQuickFilter === item.key ? 'hall-quick-chip-active' : '']"
        @tap="handleQuickFilter(item.key)"
      >
        {{ item.label }}
      </view>
    </view>

    <scroll-view class="hall-date-strip" scroll-x>
      <view class="hall-date-strip-inner">
        <view
          v-for="item in calendarDays"
          :key="item.key"
          :class="['hall-date-pill', selectedDateKey === item.key ? 'hall-date-pill-active' : '']"
          @tap="handleSelectDate(item.key)"
        >
          <text class="hall-date-week">{{ item.badgeLabel }}</text>
          <text class="hall-date-number">{{ item.dayNumber }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.hall-toolbar {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 28rpx;
}

.hall-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 0 26rpx;
  height: 92rpx;
  border-radius: 999rpx;
  background: #eef0ea;
}

.hall-search-icon {
  font-size: 28rpx;
  font-weight: 800;
  color: #6d7069;
}

.hall-search-input {
  flex: 1;
  font-size: 28rpx;
  color: #1b1c19;
}

.hall-publish-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 204rpx;
  height: 92rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111111;
  font-size: 30rpx;
  font-weight: 900;
  box-shadow: 0 14rpx 28rpx rgba(173, 214, 0, 0.18);
}

.hall-publish-button-disabled {
  background: #d8dccf;
  color: #70756c;
  box-shadow: none;
}

.hall-quick-filters {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
  margin-top: 28rpx;
}

.hall-quick-chip {
  padding: 18rpx 28rpx;
  border-radius: 999rpx;
  background: #eceee8;
  color: #242620;
  font-size: 28rpx;
  font-weight: 700;
}

.hall-quick-chip-active {
  background: #c8ff00;
  color: #111111;
}

.hall-date-strip {
  margin-top: 26rpx;
  margin-left: -28rpx;
  margin-right: -28rpx;
  padding: 0 28rpx 6rpx;
}

.hall-date-strip-inner {
  display: inline-flex;
  gap: 18rpx;
}

.hall-date-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  min-height: 126rpx;
  border-radius: 30rpx;
  background: #ffffff;
  border: 2rpx solid #eceee8;
  box-sizing: border-box;
}

.hall-date-pill-active {
  background: #c8ff00;
  border-color: #c8ff00;
}

.hall-date-week {
  font-size: 24rpx;
  color: #5f6359;
  font-weight: 700;
}

.hall-date-number {
  margin-top: 8rpx;
  font-size: 52rpx;
  line-height: 1;
  color: #141512;
  font-weight: 900;
}
</style>
