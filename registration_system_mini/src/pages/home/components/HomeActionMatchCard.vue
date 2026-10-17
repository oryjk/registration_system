<script setup lang="ts">
import { computed, ref } from "vue";
import RegistrationProgressSummary from "@/components/ui/RegistrationProgressSummary.vue";
import HomeMatchCalendar from "./HomeMatchCalendar.vue";
import { useMinioImages } from "@/composables/useMinioImages";
import { DEFAULT_MATCH_COVER_URL } from "@/config/matchCover";
import type { AvatarItem } from "@/components/ui/avatarTypes";
import type { AppMatchDetailResponse } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { buildHomeActionMatchCardState } from "../homeActionMatchCardState";

const props = defineProps<{
  match: HomeMatchCardViewModel;
  detail: AppMatchDetailResponse | null;
  loading: boolean;
  error: boolean;
  navigating: boolean;
  now: number;
  active?: boolean;
  pageCount?: number;
  pageIndex?: number;
  interactionBlocked?: boolean;
}>();
const emit = defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
  (event: "retry"): void;
  (event: "layoutChange"): void;
  (event: "expandedChange", expanded: boolean): void;
  (event: "avatarSelect", avatar: AvatarItem): void;
}>();
const card = computed(() => buildHomeActionMatchCardState(props.match, props.detail, new Date(props.now)));
const { minioImageSrc } = useMinioImages();
const failedCoverUrl = ref("");
const coverUrl = computed(() => failedCoverUrl.value === card.value.coverImageUrl ? DEFAULT_MATCH_COVER_URL : card.value.coverImageUrl);
const visiblePages = computed(() => {
  const count = props.pageCount ?? 1;
  const start = Math.max(0, Math.min((props.pageIndex ?? 0) - 2, count - 5));
  return Array.from({ length: Math.min(count, 5) }, (_, offset) => start + offset);
});
const remainingLabel = computed(() => {
  if (card.value.availability || card.value.phase !== "upcoming") return "";
  const maximum = card.value.maximum;
  return maximum && card.value.joined < maximum ? `还剩 ${maximum - card.value.joined} 个名额` : "";
});
const phaseLabel = computed(() => card.value.availability || (card.value.phase === "upcoming" ? "报名中" : card.value.phaseLabel));
function selectAvatar(id: string | number) {
  if (props.interactionBlocked || props.navigating) return;
  const avatar = card.value.avatars.find(item => item.id === id);
  if (avatar) emit("avatarSelect", avatar);
}
function openDetail() {
  if (!props.interactionBlocked && !props.navigating && props.match.canOpenDetail) emit("matchTap", props.match);
}
</script>

<template>
  <view class="home-now-card">
    <view class="now-card-heading">
      <image v-if="minioImageSrc(coverUrl)" class="now-cover-image" :src="minioImageSrc(coverUrl)" mode="aspectFill" aria-hidden="true" @error="failedCoverUrl = card.coverImageUrl" />
      <view class="now-cover-shade" />
      <view v-if="match.signupScopeLabel" class="now-scope-badge">
        <image class="now-cover-icon" src="/static/icons/lucide/users.png" mode="aspectFit" aria-hidden="true" />
        <text>{{ match.signupScopeLabel }}</text>
      </view>
      <view class="now-calendar-position"><HomeMatchCalendar :month="card.calendarMonth" :day="card.calendarDay" :weekday="card.weekday" /></view>
      <view class="now-cover-copy">
        <view class="now-time-row"><text class="now-time">{{ card.time }}</text><text v-if="card.endTime" class="now-end-time">— {{ card.endTime }}</text></view>
        <text class="now-title">{{ card.title }}</text>
      </view>
      <view v-if="(pageCount ?? 1) > 1" class="now-page-dots" :aria-label="`第 ${(pageIndex ?? 0) + 1} 场，共 ${pageCount} 场`">
        <view v-for="page in visiblePages" :key="page" class="now-page-dot" :class="{ 'now-page-dot--active': page === (pageIndex ?? 0) }" />
      </view>
    </view>
    <view class="now-body">
      <view class="now-location-row">
        <view class="now-info"><image class="now-icon" src="/static/icons/lucide/map-pin.png" mode="aspectFit" aria-hidden="true" /><text class="now-location">{{ card.venue }}</text></view>
        <text class="now-phase" :class="{ 'now-phase--neutral': card.phase !== 'upcoming' || card.availability }">{{ phaseLabel }}</text>
      </view>
      <view class="now-details-row">
        <view class="now-detail-item"><image class="now-icon" src="/static/icons/lucide/trophy.png" mode="aspectFit" aria-hidden="true" /><text class="now-meta">{{ match.formatLabel }} · 对手 {{ card.opponent }}</text></view>
        <view class="now-detail-item"><image class="now-icon" src="/static/icons/lucide/wallet.png" mode="aspectFit" aria-hidden="true" /><text class="now-meta">{{ card.feeLabel }}</text></view>
      </view>
      <view v-if="match.showRegistrationProgress" class="now-registration">
        <RegistrationProgressSummary
          :key="`${match.id}-${active !== false}`"
          :joined="card.joined"
          :minimum="card.minimum"
          :maximum="card.maximum"
          :avatars="card.avatars"
          :disabled="interactionBlocked || navigating"
          action-card
          @avatar-select="selectAvatar"
          @layout-change="emit('layoutChange')"
          @expanded-change="emit('expandedChange', $event)"
        />
      </view>
      <view class="now-action-row">
        <view class="now-personal-status">
          <view class="now-status" :class="`now-status--${card.statusTone}`"><image class="now-status-icon" :src="`/static/icons/lucide/${card.statusIcon}.png`" mode="aspectFit" aria-hidden="true" /><text>{{ card.statusLabel }}</text></view>
          <text v-if="card.deadlineLabel || remainingLabel" class="now-deadline">{{ [remainingLabel, card.deadlineLabel].filter(Boolean).join(' · ') }}</text>
        </view>
        <button class="now-primary" :disabled="interactionBlocked || navigating || !match.canOpenDetail" hover-class="now-primary-pressed" @tap="openDetail">{{ navigating ? "正在打开…" : card.actionLabel }} <text class="now-arrow">→</text></button>
      </view>
      <view v-if="loading || error" class="now-footer">
        <text v-if="loading" class="now-meta">正在核对报名信息…</text>
        <button v-else class="now-link" :disabled="interactionBlocked" hover-class="now-link-pressed" @tap="!interactionBlocked && emit('retry')">部分信息未加载，点击重试</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.home-now-card {
  --ui-avatar-plus-bg: var(--now-color-soft);
  --ui-avatar-plus-fg: var(--now-color-accent);
  --ui-avatar-border: 3rpx solid var(--now-color-surface);
  --ui-color-text-inverse: var(--now-color-surface);
  margin-top: 18rpx;
  overflow: hidden;
  border: var(--now-border);
  border-radius: var(--now-radius-card);
  background: var(--now-color-surface);
  box-shadow: var(--now-shadow);
  color: var(--now-color-text);
  box-sizing: border-box;
}
.now-card-heading { position: relative; display: flex; flex-direction: column; justify-content: flex-end; min-height: 224rpx; padding: 22rpx 26rpx; background: var(--ui-color-hero); color: var(--now-cover-fg); box-sizing: border-box; touch-action: pan-y; }
.now-cover-image, .now-cover-shade { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.now-cover-shade { background: var(--now-cover-shade); }
.now-scope-badge { position: absolute; top: 22rpx; left: 26rpx; display: flex; align-items: center; gap: 10rpx; padding: 6rpx 14rpx; border-radius: 12rpx; background: var(--now-cover-label-bg); color: var(--now-cover-fg); font-size: 22rpx; line-height: 1.5; font-weight: 500; }
.now-cover-icon { width: 26rpx; height: 26rpx; filter: var(--now-cover-icon-filter); flex-shrink: 0; }
.now-calendar-position { position: absolute; top: 22rpx; right: 24rpx; }
.now-cover-copy { position: relative; margin-top: 70rpx; padding-right: 104rpx; }
.now-time-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 14rpx; }
.now-time { font-size: 48rpx; line-height: 1.1; font-weight: 600; letter-spacing: -1rpx; font-variant-numeric: tabular-nums; }
.now-end-time { color: var(--now-cover-muted); font-size: 22rpx; line-height: 1.5; font-variant-numeric: tabular-nums; }
.now-title { display: block; margin-top: 8rpx; font-size: 34rpx; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; word-break: break-all; }
.now-page-dots { position: absolute; bottom: 18rpx; right: 24rpx; display: flex; align-items: center; gap: 8rpx; pointer-events: none; }
.now-page-dot { width: 8rpx; height: 8rpx; border-radius: 8rpx; background: var(--now-cover-muted); opacity: 0.4; }
.now-page-dot--active { width: 20rpx; opacity: 1; }
.now-body { padding: 22rpx 26rpx 26rpx; }
.now-location-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.now-info, .now-detail-item { display: flex; align-items: flex-start; gap: 10rpx; min-width: 0; }
.now-info { flex: 1; }
.now-icon { width: 28rpx; height: 28rpx; margin-top: 4rpx; flex-shrink: 0; filter: var(--ui-primitive-icon-filter); }
.now-location { min-width: 0; font-size: 26rpx; line-height: 1.5; overflow-wrap: anywhere; }
.now-phase { flex-shrink: 0; max-width: 45%; padding: 4rpx 12rpx; border-radius: 10rpx; background: var(--now-status-success-bg); color: var(--now-status-success-fg); font-size: 22rpx; line-height: 1.5; }
.now-phase--neutral { background: var(--now-status-neutral-bg); color: var(--now-status-neutral-fg); }
.now-details-row { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 10rpx 20rpx; margin-top: 12rpx; }
.now-detail-item { max-width: 100%; }
.now-detail-item .now-icon { width: 24rpx; height: 24rpx; }
.now-meta { display: block; min-width: 0; color: var(--now-color-muted); font-size: 22rpx; line-height: 1.5; overflow-wrap: anywhere; }
.now-registration { border-top: var(--now-border); margin-top: 20rpx; padding-top: 18rpx; }
.now-action-row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 20rpx; }
.now-personal-status { display: flex; flex-direction: column; gap: 6rpx; flex: 1; min-width: 0; }
.now-status { display: flex; align-items: flex-start; gap: 8rpx; color: var(--now-status-neutral-fg); font-size: 22rpx; line-height: 1.5; font-weight: 500; }
.now-status--success { color: var(--now-status-success-fg); }
.now-status--warning { color: var(--now-status-warning-fg); }
.now-status--danger { color: var(--now-status-danger-fg); }
.now-status-icon { width: 26rpx; height: 26rpx; margin-top: 3rpx; flex-shrink: 0; filter: var(--ui-primitive-icon-filter); }
.now-deadline { padding-left: 34rpx; color: var(--now-color-muted); font-size: 22rpx; line-height: 1.5; overflow-wrap: anywhere; }
.now-primary { display: flex; align-items: center; justify-content: center; flex-shrink: 0; gap: 22rpx; min-height: 88rpx; max-width: 62%; margin: 0; padding: 14rpx 28rpx; border: 0; border-radius: var(--now-radius-button); background: var(--now-color-accent); color: var(--now-color-on-accent); font-size: 26rpx; font-weight: 600; line-height: 1.5; box-sizing: border-box; }
.now-primary::after, .now-link::after { border: 0; }
.now-primary-pressed { box-shadow: var(--ui-shadow-control-pressed); }
.now-primary[disabled] { background: var(--now-color-soft); color: var(--now-color-muted); }
.now-arrow { font-size: 30rpx; }
.now-footer { margin-top: 14rpx; }
.now-link { margin: 0; padding: 10rpx 0; border: 0; background: transparent; color: var(--now-color-muted); font-size: 22rpx; line-height: 1.5; white-space: normal; text-align: left; }
.now-link-pressed { background: var(--now-color-soft); }
</style>
