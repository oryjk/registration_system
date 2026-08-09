<script setup lang="ts">
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import HomeMatchCard from "./HomeMatchCard.vue";

const props = withDefaults(defineProps<{
  variant?: "default" | "brutalist";
  matches: HomeMatchCardViewModel[];
  isGuestMode: boolean;
  navigatingMatchId: string;
  formatMatchDateBlock: (dateLabel: string) => {
    monthDay: string;
    weekday: string;
    timeLabel: string;
  };
  progressBaseWidth: (joinedPlayers: number, requiredPlayers: number, maxPlayers: number) => string;
  progressExtraWidth: (joinedPlayers: number, requiredPlayers: number, maxPlayers: number) => string;
  progressSplitLeft: (requiredPlayers: number, maxPlayers: number) => string;
  stageClass: (stage: string) => string;
  statusClass: (status: string) => string;
}>(), {
  variant: "default",
});

const emit = defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();

function handleMatchTap(match: HomeMatchCardViewModel) {
  emit("matchTap", match);
}
</script>

<template>
  <view :class="['match-list', variant === 'brutalist' ? 'match-list-brutalist' : '']">
    <HomeMatchCard
      v-for="match in matches"
      :key="match.id"
      :match="match"
      :variant="variant"
      :is-guest-mode="isGuestMode"
      :is-navigating="navigatingMatchId === match.id"
      :format-match-date-block="formatMatchDateBlock"
      :progress-base-width="progressBaseWidth"
      :progress-extra-width="progressExtraWidth"
      :progress-split-left="progressSplitLeft"
      :stage-class="stageClass"
      :status-class="statusClass"
      @match-tap="handleMatchTap"
    />
  </view>
</template>

<style scoped>
.match-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 22rpx;
}

.match-list-brutalist {
  gap: 28rpx;
  margin-top: 24rpx;
}
</style>
