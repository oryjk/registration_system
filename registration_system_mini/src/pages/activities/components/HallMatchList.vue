<script setup lang="ts">
import type { HallMatchCardViewModel } from "../hallMatchState";
import HallMatchCard from "./HallMatchCard.vue";

defineProps<{
  cards: HallMatchCardViewModel[];
}>();

const emit = defineEmits<{
  (event: "matchTap", card: HallMatchCardViewModel): void;
}>();
</script>

<template>
  <view class="hall-match-list">
    <HallMatchCard
      v-for="card in cards"
      :key="card.id"
      :card="card"
      @match-tap="emit('matchTap', card)"
    />
  </view>
</template>

<style scoped>
.hall-match-list {
  display: flex;
  flex-direction: column;
  gap: var(--neo-card-list-gap);
  margin-top: var(--neo-card-list-offset);
}
</style>
