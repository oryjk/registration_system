<script setup lang="ts">
import MatchInfoCard from "./MatchInfoCard.vue";

defineProps<{
  creditScore: number;
}>();
</script>

<template>
  <MatchInfoCard
    title="比赛说明"
    :items="[
      '名额满后可联系队长替补',
      '如遇雨天，提前 1 小时通知',
    ]"
    :score="creditScore"
    score-label="球队信用"
  />
</template>
