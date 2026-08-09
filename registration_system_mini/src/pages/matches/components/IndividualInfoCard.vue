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
      '场地固定，爽约记录低',
      '迟到 10 分钟视为请假',
      '如遇雨天，提前 1 小时通知',
    ]"
    :score="creditScore"
    score-label="本场比赛信用"
  />
</template>
