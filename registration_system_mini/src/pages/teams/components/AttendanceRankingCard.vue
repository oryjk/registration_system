<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
// #endif
import { useMinioImages } from "@/composables/useMinioImages";
import { computed } from "vue";
import type { BackendTeamAttendanceRankingItem } from "@/types/backend";
import { rankingInitial } from "../teamStatsState";
import { activityRankingAvatar, buildActivityRanking } from "../activityRanking";
// #ifndef MP-WEIXIN
import ActivityTrophyIcon from "@/components/ui/ActivityTrophyIcon.vue";
// #endif
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
  <view :class="['stats-card', embedded ? 'stats-card-embedded' : 'ui-card-panel']">
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
            <!-- #ifdef MP-WEIXIN -->
            <AppIcon name="trophy" size="var(--ui-icon-sm)" />
            <!-- #endif -->
            <!-- #ifndef MP-WEIXIN -->
            <ActivityTrophyIcon />
            <!-- #endif -->
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
@import "@/styles/list-surfaces.css";
.stats-card {
  margin-top: 16rpx;
  /* #ifndef MP-WEIXIN */
  padding: 26rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-raised);
  /* #endif */
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

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.stats-card { margin-top: var(--ui-card-gap); }
.stats-card-embedded { margin-top: 0; padding: 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); background: transparent; box-shadow: var(--ui-panel-shadow); }
.stats-card-title { font-size: var(--ui-text-heading); line-height: var(--ui-line-height-tight); font-weight: var(--ui-font-weight-heading); }
.stats-card-caption { margin-top: var(--ui-space-2); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-body); font-weight: var(--ui-font-weight-body); }
.ranking-list { margin-top: var(--ui-space-6); }
.ranking-columns { padding-bottom: var(--ui-space-3); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-body); }
.ranking-item { gap: var(--ui-list-row-gap); padding: var(--ui-list-row-padding) 0; border-top: var(--ui-list-divider); }
.ranking-order { padding: 0 var(--ui-space-1); font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-heading); }
.ranking-avatar-fallback { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.ranking-name { font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); }
.ranking-rate { font-size: var(--ui-text-title); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); }
.ranking-unit { margin-left: var(--ui-space-1); font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-body); }
.ranking-tier { gap: var(--ui-space-1); margin-top: var(--ui-space-2); padding: var(--ui-space-1) var(--ui-space-2); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-tight); font-weight: var(--ui-font-weight-heading); }
.stats-empty { margin-top: var(--ui-space-4); padding: var(--ui-panel-padding) 0; font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-body); line-height: var(--ui-line-height-body); border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); background: transparent; }
.stats-empty-inner { margin-top: var(--ui-space-4); }
.ranking-item--pressed { background: var(--ui-control-subtle-bg); }
.ranking-avatar { border: var(--ui-panel-border); }
  /* #endif */

/* #ifdef MP-WEIXIN */
.stats-card-caption, .ranking-columns, .ranking-unit, .stats-empty { color: var(--ui-color-text-secondary); }
.ranking-avatar { border-radius: var(--ui-radius-round); background: var(--ui-color-neutral-bg); }
.ranking-avatar-fallback { color: var(--ui-color-text); }
.ranking-order { background: var(--ranking-order-bg, transparent); color: var(--ranking-order-fg, var(--ui-color-text-secondary)); }
.ranking-rate { font-size: var(--ui-text-subtitle); }
.ranking-tier { font-weight: var(--ui-font-weight-medium); }
/* #endif */
</style>
