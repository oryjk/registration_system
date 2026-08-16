<script setup lang="ts">
import NeoSurface from "@/components/neo/NeoSurface.vue";
import NeoTag from "@/components/neo/NeoTag.vue";

defineProps<{
  title: string;
  items: string[];
  score: number;
  scoreLabel: string;
}>();
</script>

<template>
  <NeoSurface custom-class="match-info-card">
    <view class="match-info-card__main">
      <text class="match-info-card__title">{{ title }}</text>
      <view class="match-info-card__list">
        <view v-for="item in items" :key="item" class="match-info-card__item">
          <text class="match-info-card__dot">•</text>
          <text class="match-info-card__text">{{ item }}</text>
        </view>
      </view>
    </view>
    <NeoTag tone="lime" size="lg" class="match-info-card__score">
      <text class="match-info-card__score-value">{{ score }} 分</text>
      <text class="match-info-card__score-label">{{ scoreLabel }}</text>
    </NeoTag>
  </NeoSurface>
</template>

<style scoped>
.match-info-card {
  display: flex;
  align-items: stretch;
  gap: 20rpx;
}

.match-info-card__main {
  min-width: 0;
  flex: 1;
}

.match-info-card__title {
  display: block;
  color: var(--neo-color-text);
  font-size: 34rpx;
  line-height: 1.2;
  font-weight: 900;
}

.match-info-card__list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.match-info-card__item {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
}

.match-info-card__dot {
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1.45;
}

.match-info-card__text {
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  line-height: 1.45;
}

.match-info-card__score {
  display: flex;
  width: 164rpx;
  min-height: 118rpx;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 14rpx;
  text-align: center;
}

.match-info-card__score-value {
  color: var(--neo-color-text);
  font-size: 34rpx;
  line-height: 1;
  font-weight: 900;
}

.match-info-card__score-label {
  color: var(--neo-color-text-muted);
  font-size: 20rpx;
  line-height: 1.2;
  font-weight: 800;
}
</style>
