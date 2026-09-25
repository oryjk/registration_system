<script setup lang="ts">
import { computed } from "vue";
import AppTag from "@/components/ui/AppTag.vue";
import type { HomeMatchCardViewModel } from "@/types/viewModels";

const props = defineProps<{
  match: HomeMatchCardViewModel;
  isNavigating: boolean;
}>();

const emit = defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();

// 查看型卡：日期 + 星期 + 时间一行展示。
const compactDateLine = computed(() => {
  const block = props.match.dateBlock;
  return `${block.monthDay} ${block.weekday} ${block.timeLabel}`;
});

function handleTap() {
  if (props.match.canOpenDetail && !props.isNavigating) {
    emit("matchTap", props.match);
  }
}
</script>

<template>
  <!-- 列表统一为查看型卡；待处理记录也保留详情入口，报名展示由新的行动卡负责。 -->
  <view
    :class="['home-view-card', isNavigating ? 'home-view-card--tapping' : '']"
    :hover-class="match.canOpenDetail ? 'home-view-card--pressed' : 'none'"
    @tap="handleTap"
  >
    <view class="home-view-card__main">
      <view class="home-view-card__title-row">
        <text class="home-view-card__title">{{ match.title }}</text>
      </view>
      <text class="home-view-card__meta">{{ compactDateLine }} · {{ match.venue }}</text>
      <text v-if="match.scoreLabel" class="home-view-card__score">{{ match.scoreNote }} {{ match.scoreLabel }}</text>
    </view>
    <button
      v-if="match.canOpenDetail"
      class="home-view-card__detail"
      :aria-label="`${match.stage}，查看${match.title}详情`"
      :disabled="isNavigating"
      hover-class="home-view-card__detail--pressed"
      @tap.stop="handleTap"
    >
      <text>{{ match.stage }}</text>
      <view class="home-view-card__chevron" aria-hidden="true" />
    </button>
    <view v-else class="home-view-card__badge">
      <AppTag :tone="match.stageTone" size="sm">{{ match.stage }}</AppTag>
    </view>
  </view>
</template>

<style scoped>
/* ===== 查看型紧凑卡 ===== */
.home-view-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-sizing: border-box;
  transition: transform var(--ui-motion-press-duration) var(--ui-motion-ease-out), background-color var(--ui-motion-press-duration) ease;
}

.home-view-card--pressed,
.home-view-card--tapping {
  transform: scale(0.98);
  background: var(--ui-color-neutral-bg);
}

.home-view-card__main {
  flex: 1;
  min-width: 0;
}

.home-view-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.home-view-card__title {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  line-height: 1.35;
  color: var(--ui-color-text);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.home-view-card__meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--ui-color-text-muted);
  overflow-wrap: anywhere;
}

.home-view-card__score {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: var(--ui-color-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.home-view-card__badge {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  line-height: 0;
  white-space: nowrap;
}

.home-view-card__detail {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 12rpx;
  min-height: 72rpx;
  padding: 0 20rpx;
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
  margin: 0;
  border-radius: var(--ui-radius-round);
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-text);
  line-height: 1;
  transition: background-color var(--ui-motion-press-duration) ease;
}
.home-view-card__detail::after { border: 0; }
.home-view-card__detail--pressed { background: var(--ui-color-accent); }
.home-view-card__chevron {
  flex-shrink: 0;
  width: 14rpx;
  height: 14rpx;
  border-top: 4rpx solid currentColor;
  border-right: 4rpx solid currentColor;
  transform: translateX(-3rpx) rotate(45deg);
}

/* H5 减少动态效果：卡片按压只保留表面色反馈。 */
@media (prefers-reduced-motion: reduce) {
  .home-view-card,
  .home-view-card__detail {
    transition: none;
  }

  .home-view-card--pressed,
  .home-view-card--tapping {
    transform: none;
  }
}
</style>
