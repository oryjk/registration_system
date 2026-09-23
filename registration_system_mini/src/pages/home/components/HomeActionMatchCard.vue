<script setup lang="ts">
import { computed } from "vue";
import RegistrationProgressSummary from "@/components/ui/RegistrationProgressSummary.vue";
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
function selectAvatar(id: string | number) {
  if (props.interactionBlocked || props.navigating) return;
  const avatar = card.value.avatars.find(item => item.id === id);
  if (avatar) emit('avatarSelect', avatar);
}
const visiblePages = computed(() => {
  const count = props.pageCount ?? 1;
  const start = Math.max(0, Math.min((props.pageIndex ?? 0) - 2, count - 5));
  return Array.from({ length: Math.min(count, 5) }, (_, offset) => start + offset);
});
function openDetail() {
  if (!props.interactionBlocked && !props.navigating && props.match.canOpenDetail) emit("matchTap", props.match);
}
</script>

<template>
  <view class="home-now-card">
    <view class="now-card-heading" :class="{ 'now-card-heading--paged': (pageCount ?? 1) > 1 }">
      <view v-if="(pageCount ?? 1) > 1" class="now-page-dots" :aria-label="`第 ${(pageIndex ?? 0) + 1} 场，共 ${pageCount} 场`">
        <view v-for="page in visiblePages" :key="page" class="now-page-dot" :class="{ 'now-page-dot--active': page === (pageIndex ?? 0) }" />
      </view>
    <view class="now-date">
      <text class="now-time">{{ card.time }}</text>
      <view class="now-calendar">
        <text>{{ card.date }}</text>
        <text class="now-muted">{{ card.weekday }}</text>
      </view>
    </view>
    <view class="now-info now-title-row">
      <image class="now-icon" src="/static/icons/lucide/trophy.png" mode="aspectFit" aria-hidden="true" />
      <view class="now-title-content">
        <text class="now-title">{{ card.title }}</text>
        <text v-if="match.signupScopeLabel" class="now-scope-badge">{{ match.signupScopeLabel }}</text>
      </view>
    </view>
    </view>
    <view class="now-info now-venue-row">
      <image class="now-icon" src="/static/icons/lucide/map-pin.png" mode="aspectFit" aria-hidden="true" />
      <text class="now-location">{{ card.venue }}</text>
    </view>
    <view class="now-details-row">
      <view class="now-detail-item">
        <image class="now-icon" src="/static/icons/lucide/users.png" mode="aspectFit" aria-hidden="true" />
        <text class="now-meta">{{ match.formatLabel }} · 对手 {{ card.opponent }}</text>
      </view>
      <view class="now-detail-item">
        <image class="now-icon" src="/static/icons/lucide/wallet.png" mode="aspectFit" aria-hidden="true" />
        <text class="now-meta">{{ card.feeLabel }}</text>
      </view>
    </view>

    <view v-if="match.showRegistrationProgress" class="now-registration">
      <RegistrationProgressSummary
        :key="`${match.id}-${active !== false}`"
        :joined="card.joined"
        :minimum="card.minimum"
        :maximum="card.maximum"
        :avatars="card.avatars"
        :disabled="interactionBlocked || navigating"
        @avatar-select="selectAvatar"
        @layout-change="emit('layoutChange')"
        @expanded-change="emit('expandedChange', $event)"
      />
    </view>

    <view class="now-status-row">
      <view class="now-personal-status">
        <view class="now-status" :class="`now-status--${card.statusTone}`">
          <image class="now-status-icon" :src="`/static/icons/lucide/${card.statusIcon}.png`" mode="aspectFit" aria-hidden="true" />
          <text>{{ card.statusLabel }}</text>
        </view>
      </view>
      <text v-if="card.availability || card.deadlineLabel" class="now-deadline">{{ [card.availability, card.deadlineLabel].filter(Boolean).join(" · ") }}</text>
    </view>
    <button class="now-primary" :disabled="navigating || !match.canOpenDetail" hover-class="now-primary-pressed" @tap="openDetail">
      {{ navigating ? "正在打开…" : card.actionLabel }} <text class="now-arrow">→</text>
    </button>
    <view v-if="loading || error" class="now-footer">
      <text v-if="loading" class="now-meta">正在核对报名信息…</text>
      <button v-else-if="error" class="now-link now-retry" :disabled="interactionBlocked" hover-class="now-link-pressed" @tap="!interactionBlocked && emit('retry')">部分信息未加载，点击重试</button>
    </view>
  </view>
</template>

<style scoped>
.home-now-card {
  --ui-avatar-plus-bg: var(--now-color-soft);
  --ui-avatar-plus-fg: var(--now-color-accent);
  --ui-avatar-border: 3rpx solid var(--now-color-surface);
  --ui-color-text-inverse: var(--now-color-surface);
  --ui-color-text: var(--now-color-muted);
  margin-top: 18rpx;
  padding: 26rpx 28rpx;
  border: var(--now-border);
  border-radius: var(--now-radius-card);
  background: var(--now-color-surface);
  box-shadow: var(--now-shadow);
  color: var(--now-color-text);
  box-sizing: border-box;
}
.now-date, .now-status-row, .now-footer { display: flex; align-items: center; gap: 16rpx; }
.now-status-row, .now-footer { justify-content: space-between; }
.now-date { margin: 16rpx 0; padding-left: 20rpx; border-left: 6rpx solid var(--now-color-accent); flex-wrap: wrap; }
.now-time { font-size: 68rpx; line-height: 1.05; font-weight: 600; letter-spacing: -3rpx; font-variant-numeric: tabular-nums; }
.now-calendar { display: flex; flex-direction: column; gap: 6rpx; font-size: 26rpx; margin-left: 12rpx; }
.now-muted { color: var(--now-color-muted); }
.now-title-content { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx 12rpx; }
.now-scope-badge { flex-shrink: 0; padding: 4rpx 12rpx; border-radius: 8rpx; background: var(--now-color-soft); color: var(--now-color-accent-text); font-size: 20rpx; line-height: 1.5; font-weight: 500; }
.now-title { max-width: 100%; display: block; font-size: 34rpx; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; word-break: break-all; }
.now-meta { display: block; color: var(--now-color-muted); font-size: 24rpx; line-height: 1.6; margin-top: 8rpx; overflow-wrap: anywhere; }
.now-location { display: block; margin-top: 0; font-size: 26rpx; line-height: 1.6; overflow-wrap: anywhere; }
.now-registration { border-top: var(--now-border); margin-top: 18rpx; padding-top: 16rpx; }
.now-status-row { flex-wrap: wrap; margin: 12rpx 0; }
.now-personal-status { display: flex; align-items: center; flex-wrap: wrap; gap: 12rpx; }
.now-status { display: flex; align-items: center; gap: 8rpx; padding: 8rpx 16rpx; border-radius: 999rpx; font-size: 24rpx; font-weight: 600; background: var(--now-status-neutral-bg); color: var(--now-status-neutral-fg); }
.now-status--success { background: var(--now-status-success-bg); color: var(--now-status-success-fg); }
.now-status--warning { background: var(--now-status-warning-bg); color: var(--now-status-warning-fg); }
.now-status--danger { background: var(--now-status-danger-bg); color: var(--now-status-danger-fg); }
.now-status-icon { width: 28rpx; height: 28rpx; flex-shrink: 0; }
.now-info { display: flex; align-items: flex-start; gap: 12rpx; margin-top: 12rpx; }
.now-info > text { flex: 1; min-width: 0; margin-top: 0; }
.now-icon { width: 30rpx; height: 30rpx; margin-top: 5rpx; flex-shrink: 0; }
.now-details-row { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 8rpx 28rpx; margin-top: 10rpx; }
.now-detail-item { display: flex; align-items: flex-start; gap: 10rpx; max-width: 100%; min-width: 0; }
.now-detail-item .now-meta { min-width: 0; margin-top: 0; }
.now-venue-row { margin-top: 10rpx; }
.now-title-row .now-icon { width: 34rpx; height: 34rpx; margin-top: 9rpx; }
.now-deadline { color: var(--now-color-muted); font-size: 22rpx; }
.now-primary { display: flex; align-items: center; justify-content: center; gap: 18rpx; width: 100%; min-height: 88rpx; padding: 16rpx 24rpx; border: 0; border-radius: var(--now-radius-button); background: var(--now-color-accent); color: var(--now-color-on-accent); font-size: 30rpx; font-weight: 600; line-height: 1.5; box-sizing: border-box; }
.now-primary::after, .now-link::after { border: 0; }
.now-primary-pressed { opacity: var(--now-pressed-opacity); }
.now-primary[disabled] { background: var(--now-color-soft); color: var(--now-color-muted); }
.now-arrow { font-size: 32rpx; }
.now-link { margin: 0; padding: 12rpx 4rpx; border: 0; background: transparent; border-radius: 8rpx; color: var(--now-color-muted); font-size: 24rpx; line-height: 1.5; flex-shrink: 0; }
.now-link-pressed { background: var(--now-color-soft); }
.now-footer { flex-wrap: wrap; margin-top: 12rpx; }
.now-footer .now-meta { margin-top: 0; font-size: 22rpx; }
.now-retry { white-space: normal; text-align: left; flex-shrink: 1; }
</style>

<style scoped>
.now-page-dots { position: absolute; top: 28rpx; right: 28rpx; display: flex; align-items: center; gap: 8rpx; pointer-events: none; }
.now-page-dot { width: 8rpx; height: 8rpx; border-radius: 8rpx; background: var(--now-color-accent-text); opacity: 0.2; }
.now-page-dot--active { width: 20rpx; opacity: 0.8; }
.now-card-heading--paged .now-date { padding-right: 96rpx; }
.now-card-heading { position: relative; margin: -26rpx -28rpx 14rpx; padding: 20rpx 28rpx 12rpx; background: var(--now-color-surface); border-top: 0; border-radius: var(--now-radius-card) var(--now-radius-card) 0 0; touch-action: pan-y; }
</style>
