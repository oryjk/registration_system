<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ teamRole: string; label: string }>();
const isCaptain = computed(() => props.teamRole === "captain" || props.teamRole === "vice_captain");
</script>

<template>
  <view class="team-role-icon" role="img" :aria-label="label">
    <view v-if="isCaptain" class="captain-armband" :class="{ 'captain-armband--vice': teamRole === 'vice_captain' }">
      <text class="captain-armband__letter">C</text>
    </view>
    <wd-icon v-else :name="teamRole === 'leader' ? 'user-group' : 'user'" size="26rpx" color="var(--ui-color-text-muted)" />
  </view>
</template>

<style scoped>
.team-role-icon { display: inline-flex; align-items: center; justify-content: center; width: 32rpx; height: 30rpx; flex-shrink: 0; }
.captain-armband { display: flex; align-items: center; justify-content: center; width: 30rpx; height: 24rpx; border-radius: 5rpx; background: var(--ui-color-text); color: var(--ui-color-surface); box-sizing: border-box; }
.captain-armband__letter { font-family: Arial, sans-serif; font-size: 20rpx; font-weight: 800; line-height: 24rpx; }
.captain-armband--vice { background: var(--ui-color-neutral-bg); color: var(--ui-color-text-muted); border: 2rpx solid currentColor; }
</style>
