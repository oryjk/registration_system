<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
withDefaults(defineProps<{
  src: string;
  name: string;
  hint: string;
  actionLabel: string;
  loading?: boolean;
  disabled?: boolean;
  removable?: boolean;
}>(), { loading: false, disabled: false, removable: false });
const emit = defineEmits<{ (event: 'pick'): void; (event: 'remove'): void }>();
</script>

<template>
  <view class="team-logo-field">
    <view class="team-logo-field__preview">
      <image v-if="src" :src="src" mode="aspectFit" />
      <text v-else>{{ name.trim().slice(0, 1) || '队' }}</text>
    </view>
    <view class="team-logo-field__main">
      <text class="team-logo-field__hint">{{ hint }}</text>
      <view class="team-logo-field__actions">
        <AppButton icon="image" size="sm" variant="outline" :loading="loading" :disabled="disabled || loading" @click="emit('pick')">{{ loading ? '上传中...' : actionLabel }}</AppButton>
        <AppButton v-if="removable && src" size="sm" variant="outline" :disabled="disabled || loading" @click="emit('remove')">移除</AppButton>
      </view>
    </view>
  </view>
</template>

<style scoped>
.team-logo-field { display: flex; align-items: center; gap: 20rpx; padding: 12rpx 0; }
.team-logo-field__preview { display: flex; align-items: center; justify-content: center; width: 104rpx; height: 104rpx; flex-shrink: 0; overflow: hidden; border-radius: var(--ui-radius-button); background: var(--ui-color-neutral-bg); color: var(--ui-color-text); font-size: 38rpx; font-weight: 600; }
.team-logo-field__preview image { width: 100%; height: 100%; }
.team-logo-field__main { flex: 1; min-width: 0; }
.team-logo-field__hint { display: block; color: var(--ui-color-text-muted); font-size: 22rpx; line-height: 1.5; }
.team-logo-field__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14rpx; margin-top: 12rpx; }
</style>
