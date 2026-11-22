<script setup lang="ts">
import { computed } from "vue";
import type { PitchSlotView } from "@/types/lineup";
import { avatarInitial, formatSubBadgeText } from "../helpers";

const props = withDefaults(
  defineProps<{
    entry: PitchSlotView;
    selected?: boolean;
    currentUserId?: number | null;
    readonly?: boolean;
  }>(),
  {
    selected: false,
    currentUserId: null,
    readonly: false,
  },
);

const isCurrentUserStarter = computed(
  () => Boolean(props.currentUserId && props.entry.starter?.user_id === props.currentUserId),
);

const isCurrentUserSub = computed(
  () => Boolean(props.currentUserId && props.entry.subs.some((sub) => sub.user_id === props.currentUserId)),
);

const subBadgeText = computed(() => formatSubBadgeText(props.entry.subs));
const initialText = computed(() => avatarInitial(props.entry.starter?.nickname));
const displayName = computed(() => (props.entry.starter ? props.entry.starter.nickname : props.entry.label));
</script>

<template>
  <view
    class="dot"
    :class="{
      'dot--selected': selected,
      'dot--empty': !entry.starter,
      'dot--self': isCurrentUserStarter,
      'dot--self-sub': isCurrentUserSub,
    }"
  >
    <view class="dot__face">
      <template v-if="entry.starter">
        <image
          v-if="entry.starter.avatar_url"
          class="dot__avatar"
          :src="entry.starter.avatar_url"
          mode="aspectFill"
        />
        <text v-else class="dot__initial">{{ initialText }}</text>
      </template>
      <text v-else class="dot__plus">{{ readonly ? "待" : "+" }}</text>
      <text v-if="isCurrentUserStarter" class="dot__self-tag">我</text>
    </view>

    <view class="dot__name-pill">
      <text class="dot__name">{{ displayName }}</text>
    </view>

    <view v-if="subBadgeText" class="dot__sub-pill" :class="{ 'dot__sub-pill--self': isCurrentUserSub }">
      <text class="dot__sub-text">{{ subBadgeText }}</text>
    </view>
  </view>
</template>

<style scoped>
.dot {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: var(--ui-lineup-dot-box-width);
  box-sizing: border-box;
}

.dot__face {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ui-lineup-dot-size);
  height: var(--ui-lineup-dot-size);
  border: 4rpx solid var(--ui-lineup-dot-border);
  border-radius: var(--ui-radius-round);
  background: var(--ui-lineup-dot-bg);
  box-shadow: var(--ui-shadow-soft);
  box-sizing: border-box;
}

.dot--selected .dot__face {
  border-color: var(--ui-lineup-dot-selected-ring);
  box-shadow: 0 0 0 6rpx rgba(var(--ui-primitive-accent-rgb), 0.35);
}

.dot--self .dot__face {
  border-color: var(--ui-lineup-dot-self-ring);
}

.dot--empty .dot__face {
  border-style: dashed;
  background: var(--ui-lineup-dot-empty-bg);
  box-shadow: none;
}

.dot__avatar {
  width: 100%;
  height: 100%;
  border-radius: var(--ui-radius-round);
}

.dot__initial {
  color: var(--ui-color-text);
  font-size: var(--ui-text-title);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1;
}

.dot__plus {
  color: var(--ui-lineup-dot-name-fg);
  font-size: var(--ui-text-heading);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1;
}

.dot__self-tag {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 6rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-lineup-sub-badge-bg);
  color: var(--ui-lineup-sub-badge-fg);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-weight-heading);
  line-height: 30rpx;
  text-align: center;
  box-sizing: border-box;
}

.dot__name-pill {
  max-width: 100%;
  margin-top: 6rpx;
  padding: 2rpx 10rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-lineup-dot-name-bg);
  box-sizing: border-box;
}

.dot__name {
  display: block;
  max-width: 108rpx;
  overflow: hidden;
  color: var(--ui-lineup-dot-name-fg);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.35;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot__sub-pill {
  max-width: 100%;
  margin-top: 4rpx;
  padding: 2rpx 8rpx;
  border-radius: var(--ui-radius-round);
  background: var(--ui-lineup-sub-badge-bg);
  box-sizing: border-box;
}

.dot__sub-pill--self {
  box-shadow: 0 0 0 2rpx var(--ui-lineup-dot-border);
}

.dot__sub-text {
  display: block;
  max-width: 108rpx;
  overflow: hidden;
  color: var(--ui-lineup-sub-badge-fg);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
