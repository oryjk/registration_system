<script setup lang="ts">
import { computed } from "vue";
import MatchInfoCard from "./MatchInfoCard.vue";

const props = withDefaults(
  defineProps<{
    /** 创建比赛时填写的比赛说明；按行拆分展示，未填写时整卡隐藏。 */
    description?: string | null;
  }>(),
  {
    description: "",
  },
);

const infoItems = computed(() => (props.description ?? "")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean));

// 未填写说明时不编造默认规则；比赛类型已在 hero 标签区展示，不在此重复。
const hasContent = computed(() => infoItems.value.length > 0);
</script>

<template>
  <MatchInfoCard v-if="hasContent" title="比赛说明" :items="infoItems" />
</template>
