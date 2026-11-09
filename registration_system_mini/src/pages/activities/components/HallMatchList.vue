<script setup lang="ts">
import type { HallMatchCardViewModel } from "../hallMatchState";
// #ifdef MP-WEIXIN
import HallMatchRow from "./HallMatchRow.vue";
// #endif
// #ifndef MP-WEIXIN
import HallMatchCard from "./HallMatchCard.vue";
// #endif

defineProps<{
  cards: HallMatchCardViewModel[];
}>();

const emit = defineEmits<{
  (event: "matchTap", card: HallMatchCardViewModel): void;
}>();
</script>

<template>
  <!-- #ifdef MP-WEIXIN -->
  <!-- 与首页「已结束的比赛」一致：单张分组卡内逐行排列，行间细分割线。 -->
  <view v-if="cards.length" class="hall-match-list">
    <view
      v-for="(card, index) in cards"
      :key="card.id"
      class="hall-match-row"
      :class="{ 'hall-match-row--divided': index < cards.length - 1 }"
    >
      <HallMatchRow :card="card" @match-tap="emit('matchTap', card)" />
    </view>
  </view>
  <!-- #endif -->
  <!-- #ifndef MP-WEIXIN -->
  <view class="hall-match-list">
    <HallMatchCard
      v-for="card in cards"
      :key="card.id"
      :card="card"
      @match-tap="emit('matchTap', card)"
    />
  </view>
  <!-- #endif -->
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
.hall-match-list { gap: 0; margin-top: var(--ui-space-4); padding: var(--ui-space-1) var(--ui-home-padding); border-radius: var(--ui-home-radius); background: var(--ui-card-bg); box-shadow: var(--ui-card-shadow); }
.hall-match-row { position: relative; min-width: 0; }
.hall-match-row--divided::after { content: ""; position: absolute; right: 0; bottom: 0; left: calc(var(--ui-home-list-cover-size) + var(--ui-space-6)); border-bottom: var(--ui-border-hairline); }
/* #endif */
</style>
