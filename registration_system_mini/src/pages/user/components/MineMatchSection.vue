<script setup lang="ts">
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import NeoTag from "@/components/neo/NeoTag.vue";
import type { MineMatchSummary } from "../mineTypes";

defineProps<{
  matches: MineMatchSummary[];
}>();

const emit = defineEmits<{
  (event: "openAll"): void;
  (event: "openMatch", matchId: string): void;
}>();
</script>

<template>
  <view class="mine-match-section">
    <NeoSectionHeader
      title="我的比赛"
      marker="赛"
      caption="最近与你或所在球队相关的比赛"
      action-label="全部比赛"
      @action="emit('openAll')"
    />

    <view v-if="matches.length" class="mine-match-list">
      <NeoSurface
        v-for="match in matches"
        :key="match.id"
        interactive
        custom-class="mine-match-card"
        @tap="emit('openMatch', match.id)"
      >
        <view class="mine-match-card__main">
          <view class="mine-match-card__topline">
            <NeoTag :tone="match.statusTone" size="sm">{{ match.statusLabel }}</NeoTag>
            <text class="mine-match-card__date">{{ match.dateLabel }}</text>
          </view>
          <text class="mine-match-card__title">{{ match.title }}</text>
          <text class="mine-match-card__venue">{{ match.venue }}</text>
        </view>
        <NeoButton variant="lime" size="sm" @click="emit('openMatch', match.id)">{{ match.actionLabel }}</NeoButton>
      </NeoSurface>
    </view>

    <NeoSurface v-else variant="outlined" custom-class="mine-match-empty">
      <text class="mine-match-empty__marker">00</text>
      <view class="mine-match-empty__copy">
        <text class="mine-match-empty__title">暂无近期比赛</text>
        <text class="mine-match-empty__description">你和所在球队还没有可展示的比赛记录。</text>
      </view>
    </NeoSurface>
  </view>
</template>

<style scoped>
.mine-match-section {
  margin-top: 34rpx;
}

.mine-match-list {
  display: grid;
  gap: 16rpx;
  margin-top: 18rpx;
}

.mine-match-card {
  display: flex;
  min-height: 152rpx;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx;
}

.mine-match-card__main {
  min-width: 0;
  flex: 1;
}

.mine-match-card__topline {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.mine-match-card__date {
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.3;
}

.mine-match-card__title {
  display: block;
  margin-top: 12rpx;
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.28;
  word-break: break-word;
}

.mine-match-card__venue {
  display: block;
  margin-top: 8rpx;
  overflow: hidden;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mine-match-empty {
  display: flex;
  min-height: 160rpx;
  align-items: center;
  gap: 18rpx;
  margin-top: 18rpx;
  background: var(--neo-color-muted);
}

.mine-match-empty__marker {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 900;
}

.mine-match-empty__copy {
  min-width: 0;
}

.mine-match-empty__title,
.mine-match-empty__description {
  display: block;
}

.mine-match-empty__title {
  color: var(--neo-color-text);
  font-size: 27rpx;
  font-weight: 900;
}

.mine-match-empty__description {
  margin-top: 6rpx;
  color: var(--neo-color-text-muted);
  font-size: 22rpx;
  line-height: 1.45;
}
</style>
