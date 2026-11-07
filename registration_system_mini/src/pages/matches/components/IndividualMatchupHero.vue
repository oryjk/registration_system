<script setup lang="ts">
// #ifdef MP-WEIXIN
import AppIcon from "@/components/ui/AppIcon.vue";
import { DEFAULT_MATCH_COVER_URL } from "@/config/matchCover";
import { HOME_VISUAL_ASSETS } from "@/config/homeVisualAssets";
// #endif
import { useMinioImages } from "@/composables/useMinioImages";
import { computed, ref, watch } from "vue";
import type { BackendActivity } from "@/types/backend";
import AppSurface from "@/components/ui/AppSurface.vue";
import AppTag from "@/components/ui/AppTag.vue";
import TeamKitColor from "./TeamKitColor.vue";
import { beijingDateKey, formatMonthDayLabel, formatTimeLabel, formatWeekdayLabel } from "@/utils/datetime";

const { minioImageSrc } = useMinioImages();

const props = defineProps<{
  match: BackendActivity;
  matchKindLabel: string;
  homeTeamLabel: string;
  displayOpponentLabel: string;
  homeTeamColor: string;
  awayTeamColor: string;
  /** 主/客队 Logo；空值或加载失败回落队名首字。 */
  homeTeamLogoUrl?: string;
  awayTeamLogoUrl?: string;
  matchClockLabel: string;
  matchLocation: string;
  /** 散人约球：无主客队概念，对阵区改报已报人数。 */
  isPickupMatch?: boolean;
  /** 人均费用标签（如 ¥25.00）；空串表示免费。 */
  feeLabel?: string;
  /** 已报名人数（散人展示用）。 */
  joinedCount?: number;
}>();

defineEmits<{
  openLocation: [];
}>();

const homeLogoFailed = ref(false);
const awayLogoFailed = ref(false);
watch(() => props.homeTeamLogoUrl, () => { homeLogoFailed.value = false; });
watch(() => props.awayTeamLogoUrl, () => { awayLogoFailed.value = false; });
const homeInitial = computed(() => Array.from(props.homeTeamLabel.trim())[0] || "主");
const awayInitial = computed(() => Array.from(props.displayOpponentLabel.trim())[0] || "客");

const dateBlockDay = computed(() => formatMonthDayLabel(props.match.holding_date));
const dateBlockWeekday = computed(() => formatWeekdayLabel(props.match.holding_date));
// 结束时间补齐：起止钟点同行展示（同日比赛跨度直接跟在开始时间后）。
const endClockLabel = computed(() => {
  const end = props.match.end_time;
  if (!end) return "";
  const nextDay = beijingDateKey(end) !== beijingDateKey(props.match.holding_date);
  return `${nextDay ? formatMonthDayLabel(end) + " " : ""}${formatTimeLabel(end)}`;
});
const formatLabel = computed(() => {
  const players = props.match.players_per_team;
  return players && players > 0 ? `${players} 人制` : "";
});
const feeText = computed(() => props.feeLabel || "费用待确认");

// #ifdef MP-WEIXIN
// 与首页「最近要处理」封面一致：优先比赛自定义封面，未配置、为旧默认图或加载失败时用夜场球门照片。
const failedCoverUrl = ref("");
const coverUrl = computed(() => {
  const custom = props.match.cover?.trim() || "";
  if (!custom || custom === DEFAULT_MATCH_COVER_URL || custom === failedCoverUrl.value) return HOME_VISUAL_ASSETS.actionCover;
  return custom;
});
function handleCoverError() {
  if (coverUrl.value !== HOME_VISUAL_ASSETS.actionCover) failedCoverUrl.value = coverUrl.value;
}
// 整行点击打开地图；没有经纬度时打不开，不显示可跳转的箭头。
const hasLocationCoordinates = computed(() => props.match.location_latitude != null && props.match.location_longitude != null);
// #endif

// 终态标识只看真实比赛状态：ended/cancelled 才显示；
// 仅时间已过但状态未收敛（等待队长收尾）不显示，与首页“已结束”分区的时间推断区分开。
const matchStatusTag = computed(() => {
  if (props.match.status === 2) return "已完成";
  if (props.match.status === 3) return "已取消";
  return "";
});
</script>

<template>
  <AppSurface variant="outlined" flush>
    <view class="hero-scoreboard">
    <view class="hero-head">
      <!-- #ifdef MP-WEIXIN -->
      <image v-if="minioImageSrc(coverUrl)" class="hero-cover-image" :src="minioImageSrc(coverUrl)" mode="aspectFill" aria-hidden="true" @error="handleCoverError" />
      <view class="hero-cover-shade" />
      <!-- #endif -->
      <view class="hero-heading">
        <view class="hero-title-row">
          <text class="hero-title">{{ match.name }}</text>
          <view class="hero-title-tags">
            <text class="hero-kind">{{ matchKindLabel }}</text>
            <AppTag v-if="matchStatusTag" tone="muted" size="sm">{{ matchStatusTag }}</AppTag>
          </view>
        </view>
        <!-- 日期时间收敛为标题下的紧凑图标信息行，不再做大日期块。 -->
        <view class="hero-when">
          <!-- #ifdef MP-WEIXIN -->
          <AppIcon name="clock" size="var(--ui-icon-sm)" tone="inverse" />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <image class="hero-info-icon" src="/static/icons/lucide/clock.png" mode="aspectFit" aria-hidden="true" />
          <!-- #endif -->
          <text>{{ dateBlockDay }} {{ dateBlockWeekday }} · {{ matchClockLabel }}<text v-if="match.end_time">–{{ endClockLabel }}</text></text>
        </view>
        <!-- 人制与费用：数字与标签相邻的紧凑信息 chips。 -->
        <view class="hero-chips">
          <view v-if="formatLabel" class="hero-info"><!-- #ifdef MP-WEIXIN -->
<AppIcon name="users" size="var(--ui-icon-xs)" tone="inverse" />
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<image class="hero-info-icon" src="/static/icons/lucide/users.png" />
<!-- #endif --><text>{{ formatLabel }}</text></view>
          <view class="hero-info"><!-- #ifdef MP-WEIXIN -->
<AppIcon name="wallet" size="var(--ui-icon-xs)" tone="inverse" />
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<image class="hero-info-icon" src="/static/icons/lucide/wallet.png" />
<!-- #endif --><text>{{ feeText }}</text></view>
        </view>
      </view>
    </view>

    <!-- 地点独立一行，队服颜色随各队名称展示。 -->
    <view class="hero-foot">
      <view class="hero-venue" hover-class="hero-venue--pressed" @tap="$emit('openLocation')">
        <!-- #ifdef MP-WEIXIN -->
        <AppIcon name="map-pin" size="var(--ui-icon-sm)" color="var(--ui-tabbar-active)" />
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <image class="hero-info-icon" src="/static/icons/lucide/map-pin.png" mode="aspectFit" aria-hidden="true" />
        <!-- #endif -->
        <text class="hero-venue-text">{{ matchLocation }}</text>
        <!-- #ifdef MP-WEIXIN -->
        <AppIcon v-if="hasLocationCoordinates" name="chevron-right" size="var(--ui-icon-sm)" tone="muted" />
        <!-- #endif -->
      </view>
    </view>

    <view v-if="!isPickupMatch" class="hero-board">
      <view class="hero-team">
        <image
          v-if="homeTeamLogoUrl && !homeLogoFailed"
          class="hero-logo"
          :src="minioImageSrc(homeTeamLogoUrl)"
          @error="minioImageSrc(homeTeamLogoUrl) && (homeLogoFailed = true)"
          mode="aspectFit"
        />
        <view v-else class="hero-logo hero-logo--fallback">{{ homeInitial }}</view>
        <view class="hero-team-info">
          <text class="hero-name">{{ homeTeamLabel }}</text>
          <TeamKitColor :color="homeTeamColor" />
        </view>
      </view>
      <!-- 比分只在专属比分卡展示（含管理录入入口），对阵区固定 VS，避免重复。 -->
      <text class="hero-vs">VS</text>
      <view class="hero-team">
        <image
          v-if="awayTeamLogoUrl && !awayLogoFailed"
          class="hero-logo"
          :src="minioImageSrc(awayTeamLogoUrl)"
          @error="minioImageSrc(awayTeamLogoUrl) && (awayLogoFailed = true)"
          mode="aspectFit"
        />
        <view v-else class="hero-logo hero-logo--fallback">{{ awayInitial }}</view>
        <view class="hero-team-info">
          <text class="hero-name">{{ displayOpponentLabel }}</text>
          <TeamKitColor :color="awayTeamColor" />
        </view>
      </view>
    </view>

    </view>
  </AppSurface>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
.hero-scoreboard {
  padding: 28rpx 32rpx;
  background: var(--ui-color-surface);
  box-sizing: border-box;
}

.hero-head {
  display: flex;
  align-items: stretch;
  gap: 24rpx;
}

.hero-heading {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 10rpx;
  min-width: 0;
}

/* 日期时间紧凑信息行：替代旧的大日期块。 */
.hero-info { display: flex; align-items: center; gap: 8rpx; color: var(--ui-color-text-muted); font-size: 24rpx; }

.hero-chips {
  flex-wrap: wrap;
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 14rpx;
}

/* 散人约球对阵区：报名人数代替主客队。 */
.hero-pickup-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  margin-top: 24rpx;
  padding: 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
}

.hero-pickup-count {
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.hero-when {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 8rpx;
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  line-height: 1.4;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

/* 统一 lucide 信息图标：与首页卡片同规格。 */
.hero-info-icon {
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
}

.hero-kind {
  flex-shrink: 0;
  white-space: nowrap;
  line-height: 1.4;
  padding: 5rpx 12rpx;
  border-radius: 8rpx;
  background: var(--ui-color-success-bg);
  color: var(--ui-color-success-fg);
  font-size: 20rpx;
  font-weight: 400;
}

.hero-title-row {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.hero-title-tags {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  gap: 8rpx;
  padding-top: 5rpx;
}

.hero-title {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 34rpx;
  line-height: 1.4;
  color: var(--ui-color-text);
  font-weight: 600;
}

.hero-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56rpx minmax(0, 1fr);
  align-items: start;
  gap: 16rpx;
  margin-top: 28rpx;
  padding: 24rpx 0 0;
  border-top: var(--ui-border-default);
}

.hero-team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
  text-align: center;
}

/* 主客队徽与缺图占位统一使用圆角矩形。 */
.hero-logo {
  border-radius: var(--ui-radius-button);
  overflow: hidden;
  width: 96rpx;
  height: 96rpx;
  border: 0;
  background: transparent;
  flex-shrink: 0;
  box-sizing: border-box;
}

.hero-logo--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
  font-size: 32rpx;
  font-weight: 600;
}

.hero-team-info {
  gap: 6rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.hero-name {
  width: 100%;
  font-size: 30rpx;
  line-height: 1.4;
  color: var(--ui-color-text);
  font-weight: 600;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.hero-vs {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  font-size: 32rpx;
  line-height: 1;
  color: var(--ui-color-text-muted);
  font-weight: 600;
}

.hero-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 24rpx;
}

.hero-venue {
  display: flex;
  align-items: center;
  gap: 4rpx;
  min-width: 0;
}

.hero-venue-text {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 26rpx;
  line-height: 1.25;
  color: var(--ui-color-text);
  font-weight: 500;

}

/* #ifdef MP-WEIXIN */
.hero-scoreboard { padding: 0; overflow: hidden; }
.hero-head { position: relative; padding: var(--ui-space-7); background: var(--ui-color-hero); color: var(--now-cover-fg); overflow: hidden; }
.hero-cover-image, .hero-cover-shade { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.hero-cover-shade { background: var(--now-cover-shade); }
.hero-heading { position: relative; z-index: 1; gap: var(--ui-space-3); }
.hero-title-row { gap: var(--ui-space-4); }
.hero-title { color: var(--now-cover-fg); font-size: var(--ui-home-cover-title-size); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); text-shadow: 0 2rpx 8rpx rgba(var(--ui-primitive-ink-rgb), 0.36); }
.hero-title-tags { gap: var(--ui-space-2); }
.hero-kind { padding: var(--ui-space-1) var(--ui-space-3); border-radius: var(--ui-radius-round); font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-heading); background: var(--ui-color-accent); color: var(--ui-color-accent-fg); }
.hero-when { align-items: center; gap: var(--ui-space-2); margin-top: var(--ui-space-1); color: var(--now-cover-muted); font-size: var(--ui-text-body); line-height: var(--ui-line-height-compact); }
.hero-chips { gap: var(--ui-space-3); margin-top: var(--ui-space-2); }
.hero-info { gap: var(--ui-space-2); padding: 6rpx 18rpx; border: 1rpx solid rgba(255, 255, 255, 0.22); border-radius: var(--ui-radius-round); background: rgba(255, 255, 255, 0.14); color: var(--now-cover-fg); font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-medium); line-height: var(--ui-line-height-compact); }
.hero-foot { margin-top: 0; padding: var(--ui-space-5) var(--ui-space-7); border-bottom: var(--ui-list-divider); }
.hero-venue { width: 100%; align-items: center; gap: var(--ui-space-3); min-height: var(--ui-control-min-height); }
.hero-venue--pressed { opacity: 0.82; }
.hero-venue-text { flex: 1; line-height: var(--ui-line-height-compact); font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-medium); }
.hero-pickup-strip { border: var(--ui-panel-border); background: var(--ui-panel-soft-bg); padding: var(--ui-space-5); margin: var(--ui-space-5) var(--ui-space-7) var(--ui-space-7); }
.hero-board { border-top: 0; margin-top: 0; padding: var(--ui-space-6) var(--ui-space-7) var(--ui-space-7); align-items: center; }
.hero-name { font-size: var(--ui-text-subtitle); line-height: var(--ui-line-height-compact); }
.hero-vs { align-self: center; width: 56rpx; height: 56rpx; border-radius: var(--ui-radius-round); background: var(--ui-panel-soft-bg); color: var(--ui-color-text-secondary); font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-heading); }
/* #endif */
</style>
