<script setup lang="ts">
import SectionHeader from "@/components/ui/SectionHeader.vue";
import AppTag from "@/components/ui/AppTag.vue";
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
    <SectionHeader title="我的比赛" action-label="全部" @action="emit('openAll')" />
    <view class="mine-match-list ui-plain-panel">
      <button v-for="match in matches" :key="match.id" class="mine-match-row ui-list-row" hover-class="mine-match-row--pressed" @tap="emit('openMatch', match.id)">
        <view class="match-copy"><text class="match-title">{{ match.title }}</text><text class="match-meta">{{ match.dateLabel }} · {{ match.venue }}</text></view>
        <view class="match-action"><AppTag :tone="match.statusTone" size="sm">{{ match.statusLabel }}</AppTag><wd-icon name="arrow-right" size="26rpx" color="var(--ui-color-text-muted)" /></view>
      </button>
      <text v-if="!matches.length" class="match-empty">暂无近期比赛</text>
    </view>
  </view>
</template>
<style scoped>
@import "@/styles/list-surfaces.css";

.mine-match-section { margin-top:28rpx; }
.mine-match-list { margin-top:14rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-card); background:var(--ui-color-surface); overflow:hidden; }
.mine-match-row { margin:0; width:100%; display:flex; align-items:center; gap:16rpx; padding:24rpx; border-radius:0; border:0; background:transparent; text-align:left; line-height:1.4; }
.mine-match-row::after { border:0; }
.mine-match-row + .mine-match-row { border-top:var(--ui-border-default); }
.mine-match-row--pressed { background:var(--ui-color-neutral-bg); }
.match-copy { flex:1; min-width:0; }
.match-title { display:block; font-size:28rpx; font-weight:600; color:var(--ui-color-text); overflow-wrap:anywhere; }
.match-meta { display:block; margin-top:8rpx; font-size:22rpx; color:var(--ui-color-text-muted); }
.match-action { display:flex; align-items:center; gap:6rpx; flex-shrink:0; }
.match-empty { display:block; padding:28rpx; color:var(--ui-color-text-muted); font-size:24rpx; }


/* #ifdef MP-WEIXIN */
.mine-match-section { margin-top: var(--ui-section-gap); }
.mine-match-list { margin-top: var(--ui-space-3); border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); }
.mine-match-row { gap: var(--ui-list-row-gap); padding: var(--ui-list-row-padding) 0; min-height: var(--ui-list-row-min-height); }
.mine-match-row + .mine-match-row { border-top: var(--ui-list-divider); }
.mine-match-row--pressed { background: var(--ui-control-subtle-bg); }
.match-title { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.match-meta { margin-top: var(--ui-space-2); font-size: var(--ui-text-sm); overflow-wrap: anywhere; }
.match-action { gap: var(--ui-space-2); }
.match-empty { padding: var(--ui-list-row-padding) 0; font-size: var(--ui-text-body); }
/* #endif */
</style>
