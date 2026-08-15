<script setup lang="ts">
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import HomeMatchCard from "./HomeMatchCard.vue";

defineProps<{
  matches: HomeMatchCardViewModel[];
  isGuestMode: boolean;
  navigatingMatchId: string;
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
    <HomeMatchCard
      v-for="match in matches"
      :key="match.id"
      :match="match"
      :is-guest-mode="isGuestMode"
      :is-navigating="navigatingMatchId === match.id"
      @match-tap="handleMatchTap"
    />
  </view>
</template>

<style scoped>
.match-list {
  display: flex;
  flex-direction: column;
  gap: var(--neo-card-list-gap);
  margin-top: var(--neo-card-list-offset);
}
</style>
