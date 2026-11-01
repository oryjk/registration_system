<script setup lang="ts">
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import HomeMatchCard from "./HomeMatchCard.vue";

defineProps<{
  matches: HomeMatchCardViewModel[];
  navigatingMatchId: string;
  hideStageLabel?: boolean;
}>();

const emit = defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();

function handleMatchTap(match: HomeMatchCardViewModel) {
  emit("matchTap", match);
}
</script>

<template>
  <view class="match-list">
    <template v-for="(match, index) in matches" :key="match.id">
      <HomeMatchCard
        :match="match"
        :is-navigating="navigatingMatchId === match.id"
        :hide-stage-label="hideStageLabel"
        @match-tap="handleMatchTap"
      />
      <!-- #ifdef MP-WEIXIN -->
      <view v-if="index < matches.length - 1" class="match-list__separator" aria-hidden="true" />
      <!-- #endif -->
    </template>
  </view>
</template>

<style scoped>
.match-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-card-list-gap);
  margin-top: var(--ui-card-list-offset);
}
/* #ifdef MP-WEIXIN */
.match-list { gap: 16rpx; }
.match-list__separator { flex-shrink: 0; height: 1rpx; margin-left: 156rpx; background: var(--ui-color-line); }
/* #endif */
</style>
