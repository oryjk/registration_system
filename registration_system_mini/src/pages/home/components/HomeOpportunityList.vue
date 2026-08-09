<script setup lang="ts">
import { NeoButton, NeoDateRail, NeoProgress, NeoSurface, NeoTag } from "@/components/neo";
import type { NeoTagTone } from "@/components/neo";
import type { ChallengeCardViewModel } from "@/types/viewModels";

const props = defineProps<{
  cards: ChallengeCardViewModel[];
  challengeStageClass: (statusTone: ChallengeCardViewModel["statusTone"]) => string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "openChallenge", challengeId: string): void;
  (event: "primaryAction", card: ChallengeCardViewModel): void;
}>();

function handleOpenChallenge(challengeId: string) {
  emit("openChallenge", challengeId);
}

function handlePrimaryAction(card: ChallengeCardViewModel) {
  emit("primaryAction", card);
}

function kindTone(kind: ChallengeCardViewModel["kind"]): NeoTagTone {
  return kind === "individual" ? "dark" : "green";
}

function stageTone(statusTone: ChallengeCardViewModel["statusTone"]): NeoTagTone {
  const stageClass = props.challengeStageClass(statusTone);
  if (stageClass.includes("red")) return "red";
  if (stageClass.includes("blue")) return "blue";
  return "green";
}

function isActionDisabled(card: ChallengeCardViewModel) {
  return !card.canAccept && !card.currentUserJoined && card.statusTone === "cancelled";
}

function isActionLoading(card: ChallengeCardViewModel) {
  return props.submitting && (card.canAccept || card.currentUserJoined);
}
</script>

<template>
  <view class="opportunity-list">
    <NeoSurface
      v-for="card in cards"
      :key="card.id"
      class="opportunity-item"
      interactive
      @tap="handleOpenChallenge(card.id)"
    >
      <NeoDateRail
        :month-day-label="card.monthDayLabel"
        :weekday-label="card.weekdayLabel"
        :time-label="card.timeRangeLabel.split(' ')[0]"
      />

      <view class="opportunity-body">
        <view class="opportunity-title-row">
          <text class="opportunity-title">{{ card.title }}</text>
          <view class="opportunity-tags">
            <NeoTag :tone="kindTone(card.kind)">
              {{ card.kind === "individual" ? "散人报名" : "球队约队" }}
            </NeoTag>
            <NeoTag :tone="stageTone(card.statusTone)">{{ card.statusLabel }}</NeoTag>
          </view>
        </view>
        <text class="opportunity-meta">{{ card.hostTeamName }} · {{ card.formatLabel }}</text>
        <text class="opportunity-meta">{{ card.venue }} · {{ card.priceLabel }}</text>

        <NeoProgress
          class="opportunity-progress"
          label="报名进度"
          :value="card.acceptedCount"
          :max="card.capacity"
          :value-text="`${card.acceptedCount}/${card.capacity}`"
        />

        <view class="opportunity-bottom">
          <NeoTag tone="blue" size="md">{{ card.relationLabel }}</NeoTag>
          <NeoButton
            :variant="isActionDisabled(card) ? 'muted' : 'dark'"
            :disabled="isActionDisabled(card)"
            :loading="isActionLoading(card)"
            @click="handlePrimaryAction(card)"
          >
            {{ card.primaryActionLabel }}
          </NeoButton>
        </view>
      </view>
    </NeoSurface>
  </view>
</template>

<style scoped>
.opportunity-list {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  margin-top: 24rpx;
}

.opportunity-item {
  display: flex;
  gap: 18rpx;
}

.opportunity-body {
  flex: 1;
  min-width: 0;
}

.opportunity-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.opportunity-title {
  flex: 1;
  font-size: 32rpx;
  line-height: 1.32;
  color: var(--neo-color-text);
  font-weight: 900;
}

.opportunity-tags {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.opportunity-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--neo-color-text-muted);
  line-height: 1.45;
  font-weight: 500;
}

.opportunity-progress {
  margin-top: 16rpx;
  --neo-progress-height: 14rpx;
  --neo-progress-meta-font-weight: 700;
}

.opportunity-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 18rpx;
}

</style>
