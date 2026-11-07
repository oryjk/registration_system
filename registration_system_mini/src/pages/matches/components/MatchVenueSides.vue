<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import type { VenueSideCard } from "../venueSideState";

defineProps<{
  sides: VenueSideCard[];
  canClaim: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  (event: "claim"): void;
  (event: "release", side: VenueSideCard): void;
}>();
</script>

<template>
  <AppSurface variant="outlined" flush>
    <view class="venue-sides">
      <text class="venue-sides__title">对阵两边</text>
      <view v-for="side in sides" :key="side.groupId" class="venue-side">
        <view class="venue-side__copy">
          <text class="venue-side__name">{{ side.title }}</text>
          <text class="venue-side__caption">{{ side.caption }}</text>
        </view>
        <button
          v-if="side.releaseAction"
          class="venue-side__release"
          hover-class="venue-side__release--pressed"
          :disabled="busy"
          @tap="emit('release', side)"
        >
          {{ side.releaseAction === "withdraw" ? "退出" : "移出" }}
        </button>
      </view>
      <view v-if="canClaim" class="venue-sides__action">
        <AppButton block variant="outline" :disabled="busy" @click="emit('claim')">带队报名</AppButton>
      </view>
    </view>
  </AppSurface>
</template>

<style scoped>
.venue-sides {
  padding: var(--ui-card-padding);
}

.venue-sides__title {
  display: block;
  color: var(--ui-color-text);
  font-size: var(--ui-text-subtitle);
  font-weight: var(--ui-font-weight-heading);
}

.venue-side {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
  padding: var(--ui-space-4) 0;
  border-bottom: var(--ui-list-divider);
}

.venue-side:last-of-type {
  border-bottom: 0;
}

.venue-side__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: var(--ui-space-1);
}

.venue-side__name {
  color: var(--ui-color-text);
  font-size: var(--ui-text-label);
  font-weight: var(--ui-font-weight-heading);
  overflow-wrap: anywhere;
}

.venue-side__caption {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-text-sm);
}

.venue-side__release {
  flex-shrink: 0;
  min-height: var(--ui-control-min-height);
  margin: 0;
  padding: 0 var(--ui-space-4);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-danger-bg);
  color: var(--ui-color-danger-fg);
  font-size: var(--ui-text-sm);
  line-height: var(--ui-control-min-height);
}

.venue-side__release::after {
  border: 0;
}

.venue-side__release--pressed {
  opacity: 0.82;
}

.venue-sides__action {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: var(--ui-space-4);
}
</style>
