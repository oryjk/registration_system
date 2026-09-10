<script setup lang="ts">
import { computed } from "vue";
import MatchInfoCard from "./MatchInfoCard.vue";

const props = withDefaults(
  defineProps<{
    creditScore: number;
    publicationModeLabel?: string;
    /** 创建比赛时填写的比赛说明；按行拆分展示，未填写时回落到默认提示文案。 */
    description?: string | null;
  }>(),
  {
    publicationModeLabel: "散人对手",
    description: "",
  },
);

const infoItems = computed(() => {
  const items = [`比赛类型：${props.publicationModeLabel}`];
  const descriptionLines = (props.description ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (descriptionLines.length) return [...items, ...descriptionLines];
  return [...items, "场地固定，爽约记录低", "迟到 10 分钟视为请假", "如遇雨天，提前 1 小时通知"];
});
</script>

<template>
  <MatchInfoCard
    title="比赛说明"
    :items="infoItems"
    :score="creditScore"
    score-label="本场比赛信用"
  />
</template>
