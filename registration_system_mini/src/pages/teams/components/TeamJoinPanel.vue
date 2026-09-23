<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import type { BackendTeamSummary } from "@/types/backend";

defineProps<{
  searchKeyword: string;
  searching: boolean;
  hasSearched: boolean;
  searchResults: BackendTeamSummary[];
  selectedTeam: BackendTeamSummary | null;
  selectedTeamIsMember: boolean;
  joinedTeamIds: number[];
  selectedTeamRequiresPassword: boolean;
  joinPassword: string;
  canJoin: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "update:searchKeyword", value: string): void;
  (event: "update:joinPassword", value: string): void;
  (event: "search"): void;
  (event: "selectTeam", team: BackendTeamSummary): void;
  (event: "join"): void;
}>();

function updateSearchKeyword(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  emit("update:searchKeyword", detail.detail?.value ?? "");
}

function updateJoinPassword(event: Event) {
  const detail = event as Event & { detail?: { value?: string } };
  emit("update:joinPassword", detail.detail?.value ?? "");
}

function handleSearch() {
  emit("search");
}

function handleSelectTeam(team: BackendTeamSummary) {
  emit("selectTeam", team);
}

function handleJoin() {
  emit("join");
}
</script>

<template>
  <view class="join-search">
    <view class="search-row">
      <view class="search-field">
        <view class="search-icon" aria-hidden="true" />
        <input :value="searchKeyword" class="search-input" placeholder="输入球队名称或关键词" confirm-type="search" @input="updateSearchKeyword" @confirm="handleSearch" />
      </view>
      <view class="search-action"><AppButton block size="sm" variant="lime" :loading="searching" :disabled="searching" @click="handleSearch">搜索</AppButton></view>
    </view>
    <view class="results-heading"><text>搜索结果</text><text class="results-count">{{ searching ? '正在查找…' : hasSearched ? `${searchResults.length} 支球队` : '按名称查找' }}</text></view>
    <view v-if="searchResults.length" class="team-result-list">
      <view v-for="team in searchResults" :key="team.id" class="team-result-card" :class="{ 'team-result-card-active': selectedTeam?.id === team.id }" @tap="handleSelectTeam(team)">
        <image v-if="team.logo_url" class="team-logo" :src="team.logo_url" mode="aspectFit" />
        <view v-else class="team-logo team-logo-fallback">{{ team.name.slice(0, 1) }}</view>
        <view class="team-result-copy">
          <text class="team-result-title">{{ team.name }}</text>
          <text class="team-result-meta"><text v-if="joinedTeamIds.includes(team.id)">已加入 · </text>{{ team.member_count }} 位队员<text v-if="team.trust_label"> · {{ team.trust_label }}</text></text>
        </view>
        <text class="team-result-action">{{ selectedTeam?.id === team.id ? '已选 ✓' : '选择 →' }}</text>
      </view>
    </view>
    <view v-else class="empty-box">
      <text class="empty-title">{{ searching ? '正在查找球队' : hasSearched ? '没有找到匹配的球队' : '找到你的球队' }}</text>
      <text>{{ hasSearched ? '试试更短的关键词，或确认球队名称。' : '支持输入部分名称，选择球队后即可加入。' }}</text>
    </view>
    <view v-if="selectedTeam" class="join-panel">
      <text class="join-panel-title">{{ selectedTeamIsMember ? '你已加入' : '加入' }} {{ selectedTeam.name }}</text>
      <text class="join-panel-note">{{ selectedTeamIsMember ? '你已经是该球队成员，可直接查看球队详情。' : selectedTeamRequiresPassword ? '该球队设置了入队密码，请向队长获取。' : '该球队开放加入，确认后即可成为队员。' }}</text>
      <input v-if="selectedTeamRequiresPassword && !selectedTeamIsMember" :value="joinPassword" class="password-input" placeholder="请输入入队密码" password @input="updateJoinPassword" />
      <view class="join-action"><AppButton block :disabled="!canJoin" :loading="submitting" @click="handleJoin">{{ selectedTeamIsMember ? '查看球队 →' : submitting ? '加入中…' : '确认加入球队' }}</AppButton></view>
    </view>
  </view>
</template>

<style scoped>
.search-row { display:flex; align-items:center; gap:12rpx; }
.search-field { display:flex; align-items:center; flex:1; min-width:0; gap:12rpx; height:88rpx; padding:0 20rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-button); background:var(--ui-color-surface); box-sizing:border-box; }
.search-icon { position:relative; width:24rpx; height:24rpx; margin-right:6rpx; flex-shrink:0; border:3rpx solid var(--ui-color-text-muted); border-radius:50%; box-sizing:border-box; }
.search-icon::after { content:""; position:absolute; width:12rpx; height:3rpx; right:-9rpx; bottom:-4rpx; transform:rotate(45deg); background:var(--ui-color-text-muted); border-radius:3rpx; }
.search-input { flex:1; min-width:0; height:100%; font-size:26rpx; color:var(--ui-color-text); }
.search-action { width:136rpx; flex-shrink:0; display:flex; flex-direction:column; align-items:stretch; --ui-button-height-sm:88rpx; }
.results-heading { display:flex; align-items:center; justify-content:space-between; margin:32rpx 0 16rpx; color:var(--ui-color-text); font-size:28rpx; font-weight:600; }
.results-count { font-size:22rpx; font-weight:400; color:var(--ui-color-text-muted); }
.team-result-list { display:flex; flex-direction:column; gap:14rpx; }
.team-result-card { display:flex; align-items:center; gap:16rpx; padding:24rpx 20rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-card); background:var(--ui-color-surface); }
.team-result-card-active { border-color:var(--ui-color-accent); background:var(--ui-color-accent-soft); }
.team-logo { width:76rpx; height:76rpx; flex-shrink:0; border-radius:var(--ui-radius-button); }
.team-logo-fallback { display:flex; align-items:center; justify-content:center; background:var(--ui-color-neutral-bg); color:var(--ui-color-text); font-size:32rpx; font-weight:600; }
.team-result-copy { flex:1; min-width:0; }
.team-result-title { display:block; font-size:28rpx; font-weight:600; color:var(--ui-color-text); line-height:1.4; overflow-wrap:anywhere; }
.team-result-meta { display:block; margin-top:6rpx; font-size:22rpx; color:var(--ui-color-text-muted); line-height:1.5; }
.team-result-action { flex-shrink:0; color:var(--ui-color-accent-deep); font-size:24rpx; font-weight:600; }
.empty-box { padding:44rpx 24rpx; text-align:center; border-radius:var(--ui-radius-card); background:var(--ui-color-neutral-bg); color:var(--ui-color-text-muted); font-size:24rpx; line-height:1.6; }
.empty-title { display:block; margin-bottom:10rpx; font-size:28rpx; font-weight:600; color:var(--ui-color-text); }
.join-panel { margin-top:24rpx; padding:24rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-card); background:var(--ui-color-surface); }
.join-panel-title { display:block; font-size:28rpx; font-weight:600; color:var(--ui-color-text); }
.join-panel-note { display:block; margin-top:10rpx; font-size:24rpx; color:var(--ui-color-text-muted); line-height:1.5; }
.password-input { margin-top:20rpx; height:84rpx; padding:0 20rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-button); font-size:26rpx; color:var(--ui-color-text); }
.join-action { margin-top:24rpx; display:flex; flex-direction:column; align-items:stretch; }
</style>
