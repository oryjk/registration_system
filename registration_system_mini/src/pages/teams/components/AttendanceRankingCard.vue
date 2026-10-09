<script setup lang="ts">
import { useMinioImages } from "@/composables/useMinioImages";
import { computed } from "vue";
import type { BackendTeamAttendanceRankingItem } from "@/types/backend";
import { rankingInitial } from "../teamStatsState";
import { activityRankingAvatar, buildActivityRanking } from "../activityRanking";
import ActivityTrophyIcon from "@/components/ui/ActivityTrophyIcon.vue";
import type { AvatarItem } from "@/components/ui/avatarTypes";

const { minioImageSrc } = useMinioImages();

const props = defineProps<{
  rankingItems: BackendTeamAttendanceRankingItem[];
  cumulativeRankingItems: BackendTeamAttendanceRankingItem[];
  teamId: number;
  embedded?: boolean;
  period?: "annual" | "history";
}>();
const emit = defineEmits<{ (event: "avatar-click", avatar: AvatarItem): void }>();
const scoreRanking = computed(() => buildActivityRanking(props.rankingItems, props.cumulativeRankingItems));
</script>

<template>
  <view :class="['stats-card', embedded ? 'stats-card-embedded' : '']">
    <view class="stats-card-head">
      <view>
        <text class="stats-card-title">{{ period === "history" ? "历史活跃榜" : "年度活跃榜" }}</text>
        <text class="stats-card-caption">{{ period === "history" ? "当前球队历年累计星数（含今年）" : "本年度当前球队累计星数" }}</text>
        <text v-if="period !== 'history'" class="stats-card-caption">段位按历年累计星数评定</text>
      </view>
    </view>

    <view v-if="rankingItems.length" class="ranking-list">
      <view class="ranking-columns">
        <text>队员 · 累计段位</text>
        <text>{{ period === "history" ? "历史星数" : "年度星数" }}</text>
      </view>
      <view
        v-for="(item, index) in scoreRanking"
        :key="item.user_id"
        class="ranking-item"
        role="button"
        :aria-label="`查看${item.user_name}的头像与活跃段位`"
        hover-class="ranking-item--pressed"
        @tap="emit('avatar-click', activityRankingAvatar(item, teamId, item.cumulativeParticipationPoints))"
        :class="item.participation_points && index < 3 ? `ranking-item--${['gold', 'silver', 'bronze'][index]}` : ''"
      >
        <view class="ranking-order">{{ index + 1 }}</view>
        <image v-if="item.avatar_url" class="ranking-avatar" :src="minioImageSrc(item.avatar_url)" mode="aspectFill" />
        <view v-else class="ranking-avatar ranking-avatar-fallback">{{ rankingInitial(item) }}</view>
        <view class="ranking-copy">
          <text class="ranking-name">{{ item.user_name }}</text>
          <view
            v-if="item.tier"
            class="ranking-tier"
            :style="{ color: `var(--ui-avatar-tier-${item.tier.tone})`, backgroundColor: `var(--ui-avatar-tier-${item.tier.tone}-bg)` }"
          >
            <ActivityTrophyIcon />
            <text>{{ item.tier.title }}</text>
          </view>
        </view>
        <view class="ranking-rate">
          <text>{{ item.participation_points == null ? "待更新" : item.participation_points }}</text><text v-if="item.participation_points != null" class="ranking-unit">星</text>
        </view>
      </view>
    </view>
    <view v-else class="stats-empty stats-empty-inner">当前球队还没有可展示的排行数据。</view>
  </view>
</template>

<style scoped>
.stats-card {
  margin-top: 16rpx;
  padding: 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
}

.stats-card-embedded {
  margin-top: 0;
  padding: 0;
  border: 0;
  box-shadow: none;
}

.stats-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.stats-card-title {
  display: block;
  font-size: 34rpx;
  line-height: 1.35;
  color: var(--ui-color-text);
  font-weight: 600;
}

.stats-card-caption {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--ui-color-text-muted);
  font-weight: 400;
}

.ranking-list {
  margin-top: 24rpx;
}

.ranking-columns {
  display: flex;
  justify-content: space-between;
  padding-bottom: 14rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 22rpx 0;
  border-top: var(--ui-border-default);
}

.ranking-item--gold { --ranking-order-fg: var(--ui-avatar-tier-gold); --ranking-order-bg: var(--ui-avatar-tier-gold-bg); }
.ranking-item--silver { --ranking-order-fg: var(--ui-avatar-tier-silver); --ranking-order-bg: var(--ui-avatar-tier-silver-bg); }
.ranking-item--bronze { --ranking-order-fg: var(--ui-avatar-tier-bronze); --ranking-order-bg: var(--ui-avatar-tier-bronze-bg); }
.ranking-item--pressed { background: var(--ui-color-accent-soft); }

.ranking-order {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 44rpx;
  padding: 0 6rpx;
  border-radius: var(--ui-radius-xs);
  background: var(--ranking-order-bg, var(--ui-color-muted));
  color: var(--ranking-order-fg, var(--ui-color-text-muted));
  font-size: 24rpx;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  flex-shrink: 0;
  box-sizing: border-box;
}

.ranking-avatar {
  width: 68rpx;
  height: 68rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  flex-shrink: 0;
  background: var(--ui-color-hero);
}

.ranking-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-color-hero-fg);
  font-size: 28rpx;
  font-weight: 600;
}

.ranking-copy {
  min-width: 0;
  flex: 1;
}

.ranking-name {
  display: block;
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.ranking-rate {
  flex-shrink: 0;
  color: var(--ui-color-text);
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ranking-unit {
  margin-left: 4rpx;
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  font-weight: 400;
}

.ranking-tier {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 8rpx;
  padding: 4rpx 10rpx;
  border-radius: var(--ui-radius-xs);
  font-size: 22rpx;
  line-height: 1.4;
  font-weight: 600;
}

.stats-empty {
  margin-top: 18rpx;
  padding: 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-muted);
  color: var(--ui-color-text-muted);
  font-size: 27rpx;
  font-weight: 400;
  line-height: 1.6;
}

.stats-empty-inner {
  margin-top: 16rpx;
}
</style>
