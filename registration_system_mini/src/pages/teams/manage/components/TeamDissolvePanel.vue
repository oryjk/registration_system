<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import TeamManagePanel from "./TeamManagePanel.vue";

defineProps<{
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "dissolve"): void;
}>();
</script>

<template>
  <TeamManagePanel title="解散球队" caption="解散球队不可恢复，请谨慎操作">
    <view class="dissolve-action">
    <AppButton variant="danger" size="sm" :disabled="submitting" @click="emit('dissolve')">
      {{ submitting ? "解散中..." : "解散球队" }}
    </AppButton>
    </view>
  </TeamManagePanel>
</template>

<style scoped>

.dissolve-action { display: flex; justify-content: flex-end; }
</style>
