<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";

defineProps<{
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel?: string;
  backgroundImageUrl?: string;
}>();

const emit = defineEmits<{
  (event: "primary"): void;
  (event: "secondary"): void;
}>();
</script>

<template>
  <AppSurface variant="outlined" flush>
    <view class="hall-empty-state">
      <view class="hall-empty-state__copy">
        <view class="hall-empty-state__text">
          <text class="hall-empty-state__title">{{ title }}</text>
          <text class="hall-empty-state__description">{{ description }}</text>
        </view>
        <view v-if="backgroundImageUrl" class="hall-empty-state__art" aria-hidden="true">
          <image
            class="hall-empty-state__image"
            :src="backgroundImageUrl"
            mode="widthFix"
          />
        </view>
      </view>

      <view class="hall-empty-state__actions">
        <AppButton block variant="lime" @click="emit('primary')">{{ primaryLabel }}</AppButton>
        <button
          v-if="secondaryLabel"
          class="hall-empty-state__secondary"
          hover-class="hall-empty-state__secondary--pressed"
          @tap="emit('secondary')"
        >
          {{ secondaryLabel }}
          <text aria-hidden="true">→</text>
        </button>
      </view>
    </view>
  </AppSurface>
</template>

<style scoped>
.hall-empty-state {
  overflow: hidden;
  padding: 30rpx 28rpx 26rpx;
}

.hall-empty-state__copy {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

/* 与首页 HomeEmptyHero 的社交插画保持同尺寸、同原图比例。 */
.hall-empty-state__art {
  display: flex;
  flex: 0 0 184rpx;
  height: 144rpx;
  align-items: center;
  justify-content: flex-end;
}

.hall-empty-state__image {
  display: block;
  width: 184rpx;
  height: auto;
}

.hall-empty-state__text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}

.hall-empty-state__title {
  color: var(--ui-color-text);
  font-size: 32rpx;
  font-weight: var(--ui-font-weight-heading);
  line-height: 1.35;
}

.hall-empty-state__description {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 1.6;
}

.hall-empty-state__actions {
  margin-top: 26rpx;
}

.hall-empty-state__secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  width: 100%;
  min-height: 68rpx;
  margin: 10rpx 0 0;
  padding: 8rpx 16rpx;
  border: 0;
  background: transparent;
  color: var(--ui-color-text-muted);
  font-size: 23rpx;
  line-height: 1.4;
}

.hall-empty-state__secondary::after {
  border: 0;
}

.hall-empty-state__secondary--pressed {
  opacity: 0.65;
}
</style>
