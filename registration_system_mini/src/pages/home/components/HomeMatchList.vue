<script setup lang="ts">
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import HomeMatchCard from "./HomeMatchCard.vue";

defineProps<{
  matches: HomeMatchCardViewModel[];
  navigatingMatchId: string;
  hideStageLabel?: boolean;
  grouped?: boolean;
}>();

const emit = defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();

function handleMatchTap(match: HomeMatchCardViewModel) {
  emit("matchTap", match);
}
</script>

<template>
  <!-- #ifdef MP-WEIXIN -->
  <view class="match-list" :class="{ 'match-list--grouped': grouped }">
    <view v-for="(match, index) in matches" :key="match.id" class="match-list__item" :class="{ 'match-list__item--divided': grouped && index < matches.length - 1, 'match-list__item--with-cover': match.phase === 'ended' }">
      <HomeMatchCard
        :match="match"
        :is-navigating="navigatingMatchId === match.id"
        :hide-stage-label="hideStageLabel"
        :grouped="grouped"
        @match-tap="handleMatchTap"
      />
    </view>
  </view>
  <!-- #endif -->
  <!-- #ifndef MP-WEIXIN -->
  <view class="match-list">
    <template v-for="match in matches" :key="match.id">
      <HomeMatchCard
        :match="match"
        :is-navigating="navigatingMatchId === match.id"
        :hide-stage-label="hideStageLabel"
        @match-tap="handleMatchTap"
      />
    </template>
  </view>
  <!-- #endif -->
</template>

<style scoped>
.match-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-card-list-gap);
  margin-top: var(--ui-card-list-offset);
}
/* #ifdef MP-WEIXIN */
.match-list { gap: var(--ui-card-gap); }
.match-list--grouped { gap: 0; margin-top: var(--ui-space-4); padding: var(--ui-space-1) var(--ui-home-padding); border-radius: var(--ui-home-radius); background: var(--ui-card-bg); box-shadow: var(--ui-card-shadow); }
.match-list__item--divided { position: relative; }
.match-list__item--divided::after { content: ""; position: absolute; right: 0; bottom: 0; left: 0; border-bottom: var(--ui-border-hairline); }
.match-list__item--with-cover.match-list__item--divided::after { left: calc(var(--ui-home-list-cover-size) + var(--ui-space-7)); }
/* #endif */
</style>
