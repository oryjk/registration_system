<script setup lang="ts">
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";

defineProps<{
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "dissolve"): void;
}>();
</script>

<template>
  <NeoSurface custom-class="dissolve-card">
    <NeoSectionHeader title="危险操作" marker="!" caption="解散球队不可恢复，请谨慎操作" />
    <NeoButton variant="danger" block :disabled="submitting" @click="emit('dissolve')">
      {{ submitting ? "解散中..." : "解散球队" }}
    </NeoButton>
  </NeoSurface>
</template>

<style scoped>
.dissolve-card {
  margin-top: 22rpx;
  padding: 6rpx 24rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  box-shadow: var(--neo-shadow-raised);
}

:deep(.neo-button--block) {
  margin-top: 28rpx;
}
</style>
