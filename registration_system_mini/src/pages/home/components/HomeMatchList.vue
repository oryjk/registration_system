<script setup lang="ts">
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import HomeMatchCard from "./HomeMatchCard.vue";

defineProps<{
  matches: HomeMatchCardViewModel[];
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
      :is-navigating="navigatingMatchId === match.id"
      @match-tap="handleMatchTap"
    />
  </view>
</template>

<style scoped>
.match-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-card-list-gap);
  margin-top: var(--ui-card-list-offset);
}
</style>
