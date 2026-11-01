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
    <!-- #ifdef MP-WEIXIN -->
    <view v-for="card in cards" :key="card.id" class="hall-match-row">
      <HallMatchCard :card="card" @match-tap="emit('matchTap', card)" />
    </view>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <HallMatchCard
      v-for="card in cards"
      :key="card.id"
      :card="card"
      @match-tap="emit('matchTap', card)"
    />
    <!-- #endif -->
  </view>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
.hall-match-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-card-list-gap);
  margin-top: var(--ui-card-list-offset);
}

/* #ifdef MP-WEIXIN */
.hall-match-list { gap: var(--ui-card-gap); margin-top: var(--ui-list-gap); }
.hall-match-row { min-width: 0; }
/* #endif */
</style>
