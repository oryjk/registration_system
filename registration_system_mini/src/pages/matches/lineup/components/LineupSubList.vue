<script setup lang="ts">
import type { PitchSlotView } from "@/types/lineup";
import { avatarInitial } from "../helpers";

defineProps<{
  slots: PitchSlotView[];
  readonly: boolean;
  currentUserId?: number | null;
}>();

const emit = defineEmits<{
  (event: "open-starter", slot: number): void;
  (event: "open-sub", slot: number): void;
  (event: "remove-sub", slot: number, userId: number): void;
}>();
</script>

<template>
  <view class="sub-card ui-card-panel">
    <view class="sub-card__head">
      <view class="sub-card__title-group">
        <text class="sub-card__title">主力 ⇄ 替补对应表</text>
        <text class="sub-card__caption">按位置展示每位首发与对应替补，上场轮换一目了然</text>
      </view>
    </view>

    <view class="sub-list">
      <view
        v-for="entry in slots"
        :key="entry.slot"
        class="sub-row"
        :class="{
          'sub-row--mine':
            Boolean(currentUserId) &&
            (entry.starter?.user_id === currentUserId || entry.subs.some((s) => s.user_id === currentUserId)),
        }"
      >
        <view class="sub-row__top">
          <view class="sub-row__pos">
            <text class="sub-row__pos-text">{{ entry.label }}</text>
          </view>

          <view
            class="sub-row__starter"
            :hover-class="readonly ? 'none' : 'sub-row__starter--pressed'"
            @tap="!readonly && emit('open-starter', entry.slot)"
          >
            <view class="sub-row__avatar">
              <image
                v-if="entry.starter?.avatar_url"
                class="sub-row__avatar-img"
                :src="entry.starter.avatar_url"
                mode="aspectFill"
              />
              <text v-else class="sub-row__avatar-initial">
                {{ entry.starter ? avatarInitial(entry.starter.nickname) : "+" }}
              </text>
            </view>
            <text
              class="sub-row__starter-name"
              :class="{ 'sub-row__starter-name--empty': !entry.starter }"
            >
              {{ entry.starter ? entry.starter.nickname : "待定" }}
            </text>
            <text v-if="currentUserId && entry.starter?.user_id === currentUserId" class="sub-row__mine-badge">
              我
            </text>
          </view>

          <button
            v-if="!readonly"
            class="sub-row__assign-btn ui-subtle-control"
            hover-class="sub-row__assign-btn--pressed"
            @tap="emit('open-sub', entry.slot)"
          >
            {{ entry.subs.length ? "调整替补" : "指定替补" }}
          </button>
        </view>

        <view class="sub-row__bottom">
          <text class="sub-row__arrow">⇄ 替补</text>
          <view v-if="entry.subs.length" class="sub-row__chips">
            <view
              v-for="sub in entry.subs"
              :key="sub.user_id"
              class="sub-chip"
              :class="{ 'sub-chip--mine': currentUserId === sub.user_id }"
            >
              <text class="sub-chip__name">{{ sub.nickname }}</text>
              <text v-if="currentUserId === sub.user_id" class="sub-chip__mine">我</text>
              <text
                v-if="!readonly"
                class="sub-chip__remove"
                @tap.stop="emit('remove-sub', entry.slot, sub.user_id)"
              >
                ×
              </text>
            </view>
          </view>
          <text v-else class="sub-row__empty-sub">暂无指定替补</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";

.sub-card {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.sub-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
}

.sub-card__title-group {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.sub-card__title {
  color: var(--ui-color-text);
  font-size: var(--ui-text-title);
  font-weight: var(--ui-font-weight-heading);
  line-height: var(--ui-line-height-tight);
}

.sub-card__caption {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-sm);
  line-height: var(--ui-line-height-compact);
}

.sub-list {
  display: flex;
  flex-direction: column;
}

.sub-row {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  padding: var(--ui-space-4) 0;
  border-top: var(--ui-list-divider);
}

.sub-row:first-child {
  border-top: 0;
  padding-top: var(--ui-space-2);
}

.sub-row--mine {
  margin: 0 calc(-1 * var(--ui-space-3));
  padding: var(--ui-space-4) var(--ui-space-3);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-accent-subtle);
}

.sub-row__top {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}

.sub-row__pos {
  flex-shrink: 0;
  min-width: 96rpx;
  padding: 6rpx 14rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-neutral-bg);
  text-align: center;
  box-sizing: border-box;
}

.sub-row__pos-text {
  color: var(--ui-color-text);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.3;
}

.sub-row__starter {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: 6rpx 8rpx;
  border-radius: var(--ui-radius-button);
}

.sub-row__starter--pressed {
  background: var(--ui-color-neutral-bg);
}

.sub-row__avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ui-avatar-size-sm);
  height: var(--ui-avatar-size-sm);
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent-soft);
  overflow: hidden;
}

.sub-row__avatar-img {
  width: 100%;
  height: 100%;
}

.sub-row__avatar-initial {
  color: var(--ui-color-text);
  font-size: var(--ui-text-body);
  font-weight: var(--ui-font-weight-heading);
}

.sub-row__starter-name {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-color-text);
  font-size: var(--ui-text-label);
  font-weight: var(--ui-font-weight-heading);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-row__starter-name--empty {
  color: var(--ui-color-text-secondary);
  font-weight: var(--ui-font-weight-body);
}

.sub-row__mine-badge {
  flex-shrink: 0;
  padding: 2rpx 10rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent);
  color: var(--ui-color-accent-fg);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-weight-heading);
}

.sub-row__assign-btn {
  flex-shrink: 0;
  height: 58rpx;
  min-height: 58rpx;
  margin: 0;
  padding: 0 20rpx;
  font-size: var(--ui-text-sm);
  line-height: 1;
}

.sub-row__assign-btn::after {
  border: 0;
}

.sub-row__assign-btn--pressed {
  box-shadow: var(--ui-shadow-control-pressed);
}

.sub-row__bottom {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3);
  padding-left: 8rpx;
}

.sub-row__arrow {
  flex-shrink: 0;
  padding-top: 6rpx;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-weight-medium);
}

.sub-row__chips {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

.sub-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  max-width: 100%;
  padding: 6rpx 16rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-warning-bg);
  color: var(--ui-color-warning-fg);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-weight-heading);
}

.sub-chip--mine {
  background: var(--ui-lineup-sub-badge-bg);
  color: var(--ui-lineup-sub-badge-fg);
}

.sub-chip__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-chip__mine {
  padding: 0 8rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-text);
  color: var(--ui-color-text-inverse);
  font-size: var(--ui-text-xs);
}

.sub-chip__remove {
  padding: 0 4rpx;
  font-size: var(--ui-text-label);
  line-height: 1;
}

.sub-row__empty-sub {
  padding-top: 6rpx;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-sm);
}
</style>
