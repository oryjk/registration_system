<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import AppSurface from "@/components/ui/AppSurface.vue";

defineProps<{
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "dissolve"): void;
}>();
</script>

<template>
  <AppSurface custom-class="dissolve-card">
    <SectionHeader title="危险操作" caption="解散球队不可恢复，请谨慎操作" />
    <AppButton variant="danger" block :disabled="submitting" @click="emit('dissolve')">
      {{ submitting ? "解散中..." : "解散球队" }}
    </AppButton>
  </AppSurface>
</template>

<style scoped>
.dissolve-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  box-shadow: none;
}

:deep(.ui-button--block) {
  margin-top: 28rpx;
}
</style>
