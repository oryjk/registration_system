<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { VenueHistoryItem } from "./venueHistory";

const props = defineProps<{
  modelValue: string;
  venues: VenueHistoryItem[];
  selectedFromMap: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  focus: [];
  manualInput: [];
  select: [venue: VenueHistoryItem];
  chooseLocation: [];
}>();

const open = ref(false);
const query = ref("");
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const filteredVenues = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  return keyword ? props.venues.filter((venue) => venue.location.toLocaleLowerCase().includes(keyword)) : props.venues;
});

function cancelClose() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
}

function handleFocus() {
  cancelClose();
  query.value = "";
  open.value = true;
  emit("focus");
}

function handleBlur() {
  cancelClose();
  // 小程序 input 的 blur 可能先于列表 tap；给列表选项留出点击时间。
  closeTimer = setTimeout(() => { open.value = false; }, 300);
}

function handleInput(event: Event) {
  const value = (event as unknown as { detail: { value: string } }).detail.value;
  query.value = value;
  emit("update:modelValue", value);
  emit("manualInput");
}

function closeList() {
  cancelClose();
  open.value = false;
  uni.hideKeyboard();
}

function handleSelect(venue: VenueHistoryItem) {
  closeList();
  emit("select", venue);
}

function handleChooseLocation() {
  closeList();
  emit("chooseLocation");
}

onBeforeUnmount(cancelClose);
</script>

<template>
  <view class="venue-field">
    <input
      class="venue-field__input"
      :value="modelValue"
      maxlength="120"
      :cursor-spacing="180"
      placeholder="输入球场名称，或选择最近使用"
      placeholder-class="venue-field__placeholder"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="handleInput"
    />

    <view v-if="open" class="venue-field__list">
      <view class="venue-field__option venue-field__option--map" hover-class="venue-field__option--pressed" @tap="handleChooseLocation">
        <image class="venue-field__icon" src="/static/icons/lucide/map-pin.png" mode="aspectFit" aria-hidden="true" />
        <text class="venue-field__option-text">{{ venues.length ? "没有合适的历史？打开地图选择" : "没有历史？打开地图选择" }}</text>
        <text class="venue-field__arrow">›</text>
      </view>

      <template v-if="filteredVenues.length">
        <text class="venue-field__heading">最近场地</text>
        <view
          v-for="venue in filteredVenues"
          :key="venue.location"
          class="venue-field__option"
          hover-class="venue-field__option--pressed"
          @tap="handleSelect(venue)"
        >
          <image class="venue-field__icon" src="/static/icons/lucide/clock.png" mode="aspectFit" aria-hidden="true" />
          <text class="venue-field__option-text">{{ venue.location }}</text>
        </view>
      </template>
      <text v-else-if="venues.length && query.trim()" class="venue-field__empty">没有匹配的历史，可继续输入场地名称</text>
    </view>

    <text v-if="selectedFromMap" class="venue-field__hint">已关联地图位置，详情页可直接打开地图</text>
  </view>
</template>

<style scoped>
.venue-field { position: relative; }

.venue-field__input {
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 28rpx;
  box-sizing: border-box;
}

.venue-field__placeholder {
  color: var(--ui-color-text-disabled);
  font-size: 24rpx;
}

.venue-field__list {
  margin-top: 10rpx;
  padding: 8rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-soft);
}

.venue-field__heading {
  display: block;
  padding: 12rpx 14rpx 4rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
}

.venue-field__option {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-height: 76rpx;
  padding: 12rpx 14rpx;
  border-radius: var(--ui-radius-button);
  box-sizing: border-box;
}

.venue-field__option--map { background: var(--ui-color-accent-soft); }
.venue-field__option--pressed { opacity: 0.7; }
.venue-field__icon {
  width: 26rpx;
  height: 26rpx;
  flex-shrink: 0;
  filter: var(--ui-primitive-icon-filter, none);
}
.venue-field__option-text {
  flex: 1;
  min-width: 0;
  color: var(--ui-color-text);
  font-size: 24rpx;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.venue-field__arrow { color: var(--ui-color-text-muted); font-size: 32rpx; }
.venue-field__empty {
  display: block;
  padding: 14rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
}
.venue-field__hint {
  display: block;
  margin-top: 12rpx;
  color: var(--ui-color-success-fg);
  font-size: 22rpx;
  line-height: 1.5;
}
</style>
