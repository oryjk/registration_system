<script setup lang="ts">
import { computed } from "vue";
import RegistrationProgressSummary from "@/components/ui/RegistrationProgressSummary.vue";
import HomeMatchThumbnail from "@/pages/home/components/HomeMatchThumbnail.vue";
import type { HallMatchCardViewModel } from "../hallMatchState";

// 微信大厅列表行：上半与首页「已结束的比赛」同一套封面缩略图 + 三行信息，下半为带头像的报名进度与满员提示。
const props = defineProps<{ card: HallMatchCardViewModel }>();
const emit = defineEmits<{ (event: "matchTap", card: HallMatchCardViewModel): void }>();

const statusClass = computed(() => {
  if (props.card.opponentStateTone === "muted") return "hall-row__status--muted";
  return props.card.opponentStateTone === "green" ? "hall-row__status--success" : "hall-row__status--warning";
});
const thumbnailMatch = computed(() => ({ id: props.card.id, coverImageUrl: props.card.coverImageUrl }));

function handleTap() {
  emit("matchTap", props.card);
}
</script>

<template>
  <view class="hall-row" hover-class="hall-row--pressed" @tap="handleTap">
    <view class="hall-row__top">
      <view class="hall-row__thumbnail">
        <HomeMatchThumbnail :match="thumbnailMatch" />
        <view class="hall-row__thumb-overlay" aria-hidden="true">
          <text class="hall-row__thumb-date">{{ card.dateBlock.monthDay }}</text>
          <text class="hall-row__thumb-time">{{ card.dateBlock.timeLabel }}</text>
        </view>
      </view>
      <view class="hall-row__main">
        <text class="hall-row__title">{{ card.title }}</text>
        <view class="hall-row__tags">
          <text class="hall-row__kind">{{ card.kindLabel }}</text>
          <text class="hall-row__status" :class="statusClass">{{ card.opponentStateLabel }}</text>
          <text class="hall-row__extra">{{ card.hostTeamName || card.formatLabel }}</text>
        </view>
        <view class="hall-row__info">
          <image class="hall-row__info-icon" src="/static/icons/lucide/map-pin.png" mode="aspectFit" aria-hidden="true" />
          <text>{{ card.venue || "场地待定" }}</text>
        </view>
      </view>
      <view v-if="card.actionKind !== 'view'" class="hall-row__action">
        <text>{{ card.actionLabel }}</text>
        <image class="hall-row__action-chevron" src="/static/home-icons/chevron-right.png" mode="aspectFit" aria-hidden="true" />
      </view>
      <image v-else class="hall-row__chevron" src="/static/home-icons/chevron-right.png" mode="aspectFit" aria-hidden="true" />
    </view>
    <view v-if="card.showProgress" class="hall-row__progress-list">
      <view v-for="bar in card.progressBars" :key="bar.key" class="hall-row__progress">
        <RegistrationProgressSummary
          compact
          :title="bar.key === 'host' ? '主队报名' : bar.key === 'guest' ? '客队报名' : bar.label"
          :joined="bar.joined"
          :minimum="bar.required"
          :maximum="bar.max"
          :avatars="bar.avatars"
        />
      </view>
    </view>
    <view v-if="card.capacityHint" class="hall-row__capacity-hint">
      <text>{{ card.capacityHint }}</text>
    </view>
  </view>
</template>

<style scoped>
.hall-row { padding: var(--ui-space-5) 0; box-sizing: border-box; }
.hall-row__top { display: flex; align-items: center; gap: var(--ui-space-6); }
.hall-row--pressed { background: var(--ui-color-accent-subtle); }
.hall-row__thumbnail { position: relative; flex: 0 0 var(--ui-home-list-cover-size); width: var(--ui-home-list-cover-size); height: var(--ui-home-list-cover-size); overflow: hidden; border-radius: var(--ui-radius-button); }
.hall-row__thumb-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: var(--ui-space-2); background: var(--now-thumb-shade); color: var(--now-cover-fg); text-align: center; box-sizing: border-box; pointer-events: none; }
.hall-row__thumb-date { color: var(--now-cover-muted); font-size: var(--ui-text-xs); line-height: 1.2; font-variant-numeric: tabular-nums; }
.hall-row__thumb-time { font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-heading); line-height: 1.25; font-variant-numeric: tabular-nums; }
.hall-row__main { flex: 1; min-width: 0; }
.hall-row__title { display: block; overflow: hidden; color: var(--ui-color-text); font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); white-space: nowrap; text-overflow: ellipsis; }
.hall-row__tags { display: flex; align-items: center; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
.hall-row__kind,
.hall-row__status { flex-shrink: 0; padding: 2rpx var(--ui-space-2); border-radius: var(--ui-radius-sm); font-size: var(--ui-text-xs); font-weight: var(--ui-font-weight-medium); line-height: 1.4; }
.hall-row__kind { background: var(--ui-color-accent-soft); color: var(--ui-color-text); }
.hall-row__status--success { background: var(--ui-color-success-bg); color: var(--ui-color-success-fg); }
.hall-row__status--warning { background: var(--ui-color-warning-bg); color: var(--ui-color-warning-fg); }
.hall-row__status--muted { background: var(--ui-color-neutral-bg); color: var(--ui-color-neutral-fg); }
.hall-row__extra { flex: 1; min-width: 0; overflow: hidden; color: var(--ui-home-muted); font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-medium); white-space: nowrap; text-overflow: ellipsis; }
.hall-row__info { display: flex; align-items: center; gap: var(--ui-space-2); margin-top: var(--ui-space-2); color: var(--ui-home-muted); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-compact); }
.hall-row__info text { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.hall-row__info-icon { flex-shrink: 0; width: var(--ui-icon-xs); height: var(--ui-icon-xs); }
/* 纵向 flex + stretch 让进度组件宿主节点撑满整行，避免微信端宿主收缩为内容宽。 */
.hall-row__progress-list { display: flex; flex-direction: column; align-items: stretch; gap: var(--ui-space-4); margin-top: var(--ui-space-5); }
.hall-row__progress { display: flex; flex-direction: column; align-items: stretch; min-width: 0; }
.hall-row__capacity-hint { margin-top: var(--ui-space-4); padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-control-radius); background: var(--ui-panel-soft-bg); color: var(--ui-color-neutral-fg); font-size: var(--ui-text-xs); line-height: 1.5; }
/* 次级文字胶囊：浅薄荷底 + 墨色字 + 细线箭头，与类型标签同色系，不与列表抢主次。 */
.hall-row__action { display: flex; align-items: center; flex-shrink: 0; gap: 2rpx; height: 56rpx; padding: 0 var(--ui-space-2) 0 var(--ui-space-4); border-radius: var(--ui-radius-round); background: var(--ui-color-accent-soft); color: var(--ui-color-text); font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-medium); line-height: 1; white-space: nowrap; }
.hall-row__action-chevron { flex-shrink: 0; width: var(--ui-icon-sm); height: var(--ui-icon-sm); }
.hall-row__chevron { flex-shrink: 0; width: var(--ui-icon-md); height: var(--ui-icon-md); }
</style>
