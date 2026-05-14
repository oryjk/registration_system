<script setup lang="ts">
import { computed } from "vue";
import type { ChallengeCardViewModel } from "@/types/viewModels";

const props = defineProps<{
  card: ChallengeCardViewModel;
  submitting: boolean;
  variant: ChallengeCardViewModel["kind"];
}>();

const emit = defineEmits<{
  (event: "open", card: ChallengeCardViewModel): void;
  (event: "primaryAction", card: ChallengeCardViewModel): void;
}>();

const scoreLabel = computed(() => (props.variant === "team" ? `${props.card.creditScore} 分` : `${props.card.acceptedCount}/${props.card.capacity}`));
const metaLabel = computed(() =>
  props.variant === "team"
    ? `信用 ${props.card.creditScore} · ${props.card.trustLabel}`
    : `已报名 ${props.card.acceptedCount}/${props.card.capacity} · ${props.card.trustLabel}`,
);

function tagClass(tag: string) {
  if (props.variant === "team" && tag === props.card.trustLabel) return "hall-tag-credit";
  if (tag === props.card.relationLabel) return "hall-tag-relation";
  return "";
}

function handleOpen() {
  emit("open", props.card);
}

function handlePrimaryAction() {
  emit("primaryAction", props.card);
}
</script>

<template>
  <view class="hall-card" @tap="handleOpen">
    <view class="hall-card-top">
      <view class="hall-card-title-wrap">
        <text class="hall-card-title">{{ card.title }}</text>
        <view class="hall-card-tags">
          <text
            v-for="tag in card.quickTags"
            :key="tag"
            :class="['hall-tag', tagClass(tag)]"
          >
            {{ tag }}
          </text>
        </view>
      </view>
      <view class="hall-card-price">
        <text :class="['hall-status-badge', `hall-status-badge-${card.statusTone}`]">{{ card.statusLabel }}</text>
        <text class="hall-card-price-text">{{ card.priceLabel }}</text>
      </view>
    </view>

    <view class="hall-meta-row">
      <text class="hall-meta-icon">场</text>
      <text class="hall-meta-text">{{ card.venue }}</text>
    </view>
    <view class="hall-meta-row">
      <text class="hall-meta-icon">时</text>
      <text class="hall-meta-text">{{ card.monthDayLabel }} {{ card.weekdayLabel }} {{ card.timeRangeLabel }}</text>
    </view>

    <view v-if="card.note" class="hall-note">{{ card.note }}</view>

    <view class="hall-card-bottom">
      <view class="hall-team-block">
        <view class="hall-team-logo">{{ card.teamInitial }}</view>
        <view class="hall-team-info">
          <text class="hall-team-name">{{ card.hostTeamName }}</text>
          <text class="hall-team-meta">{{ metaLabel }}</text>
        </view>
      </view>
      <view class="hall-card-action-column">
        <text class="hall-score-chip">{{ scoreLabel }}</text>
        <view class="hall-card-button" @tap.stop="handlePrimaryAction">
          {{ submitting && card.canAccept ? "处理中..." : card.primaryActionLabel }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.hall-card {
  padding: 28rpx;
  border-radius: 34rpx;
  background: #ffffff;
  box-shadow: 0 24rpx 46rpx rgba(17, 17, 17, 0.06);
}

.hall-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.hall-card-title-wrap {
  flex: 1;
}

.hall-card-title {
  display: block;
  font-size: 38rpx;
  line-height: 1.3;
  color: #111111;
  font-weight: 900;
}

.hall-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.hall-tag {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #f1f3ec;
  color: #3f443c;
  font-size: 22rpx;
  font-weight: 800;
}

.hall-tag-credit {
  background: #eef8d1;
  color: #4b6600;
}

.hall-tag-relation {
  background: #eef0ff;
  color: #4564d6;
}

.hall-card-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
}

.hall-card-price-text {
  font-size: 56rpx;
  line-height: 1;
  color: #111111;
  font-weight: 900;
}

.hall-status-badge {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.hall-status-badge-open {
  background: #eff8d3;
  color: #4c6700;
}

.hall-status-badge-matched {
  background: #e8eeff;
  color: #4564d6;
}

.hall-status-badge-cancelled {
  background: #ffe8eb;
  color: #cf4258;
}

.hall-meta-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 18rpx;
}

.hall-meta-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border-radius: 999rpx;
  background: #f1f3ec;
  color: #5c6259;
  font-size: 20rpx;
  font-weight: 900;
}

.hall-meta-text {
  flex: 1;
  font-size: 28rpx;
  line-height: 1.5;
  color: #555a52;
}

.hall-note {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  background: #f7f8f3;
  color: #42463f;
  font-size: 26rpx;
  line-height: 1.5;
}

.hall-card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 24rpx;
}

.hall-team-block {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.hall-team-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 82rpx;
  height: 82rpx;
  border-radius: 999rpx;
  background: #1a1a19;
  color: #c8ff00;
  font-size: 34rpx;
  font-weight: 900;
  flex-shrink: 0;
}

.hall-team-info {
  min-width: 0;
}

.hall-team-name {
  display: block;
  font-size: 30rpx;
  color: #141512;
  font-weight: 900;
}

.hall-team-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #666b63;
}

.hall-card-action-column {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16rpx;
}

.hall-score-chip {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #eef8d1;
  color: #597400;
  font-size: 24rpx;
  font-weight: 900;
}

.hall-card-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 182rpx;
  height: 84rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #111111;
  font-size: 30rpx;
  font-weight: 900;
}
</style>
