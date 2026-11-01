<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { useMinioImages } from "@/composables/useMinioImages";
import AppButton from "@/components/ui/AppButton.vue";
// #ifdef MP-WEIXIN
import StickyActionBar from "@/components/ui/StickyActionBar.vue";
// #endif
import type { BackendTeamSummary } from "@/types/backend";

const { minioImageSrc } = useMinioImages();

const props = withDefaults(defineProps<{
  searchKeyword: string;
  searching: boolean;
  hasSearched: boolean;
  loadError?: string;
  showCreateEntry?: boolean;
  inactive?: boolean;
  searchResults: BackendTeamSummary[];
  selectedTeam: BackendTeamSummary | null;
  selectedTeamIsMember: boolean;
  joinedTeamIds: number[];
  selectedTeamRequiresPassword: boolean;
  joinPassword: string;
  canJoin: boolean;
  submitting: boolean;
}>(), { loadError: "", showCreateEntry: false, inactive: false });

// Keep only public display metadata while the fixed panel animates out.
// The live selection remains the sole source for actual join actions.
const liveConfirmation = computed(() => props.selectedTeam && !props.inactive ? {
  team: props.selectedTeam,
  isMember: props.selectedTeamIsMember,
  requiresPassword: props.selectedTeamRequiresPassword,
} : null);
const lastConfirmation = shallowRef(liveConfirmation.value);
watch(liveConfirmation, value => { if (value) lastConfirmation.value = value; }, { flush: "sync" });
const confirmation = computed(() => {
  // #ifdef MP-WEIXIN
  return liveConfirmation.value ?? lastConfirmation.value;
  // #endif
  // #ifndef MP-WEIXIN
  return liveConfirmation.value;
  // #endif
});
const confirmationVisible = computed(() => !!props.selectedTeam && !props.inactive);

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
    <!-- #ifdef MP-WEIXIN -->
    <view v-if="!inactive" class="join-directory">
    <!-- #endif -->
    <view class="search-row">
      <view class="search-field">
        <view class="search-icon" aria-hidden="true" />
        <input :value="searchKeyword" class="search-input" placeholder="输入球队名称或关键词" confirm-type="search" @input="updateSearchKeyword" @confirm="handleSearch" />
      </view>
      <view class="search-action"><AppButton block size="sm" variant="lime" :loading="searching" :disabled="searching" @click="handleSearch">搜索</AppButton></view>
    </view>
    <!-- #ifdef MP-WEIXIN -->
    <view v-if="showCreateEntry" class="directory-create-entry"><slot name="createTeam" /></view>
    <view class="results-heading"><text>{{ searchKeyword.trim() ? '筛选结果' : '全部球队' }}</text><text class="results-count">{{ searching ? '正在加载…' : hasSearched ? `${searchResults.length} 支球队` : '' }}</text></view>
    <view v-if="loadError" class="directory-error ui-soft-panel" @tap="handleSearch"><text>{{ loadError }}</text><text>点击重试</text></view>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <view class="results-heading"><text>搜索结果</text><text class="results-count">{{ searching ? '正在查找…' : hasSearched ? `${searchResults.length} 支球队` : '按名称查找' }}</text></view>
    <!-- #endif -->
    <view v-if="searchResults.length" class="team-result-list ui-card-list">
      <view v-for="team in searchResults" :key="team.id" class="team-result-card ui-list-row" :class="{ 'team-result-card-active': selectedTeam?.id === team.id }" @tap="handleSelectTeam(team)">
        <image v-if="team.logo_url" class="team-logo" :src="minioImageSrc(team.logo_url)" mode="aspectFit" />
        <view v-else class="team-logo team-logo-fallback">{{ team.name.slice(0, 1) }}</view>
        <view class="team-result-copy">
          <text class="team-result-title">{{ team.name }}</text>
          <text class="team-result-meta"><text v-if="joinedTeamIds.includes(team.id)">已加入 · </text>{{ team.member_count }} 位队员<text v-if="team.trust_label"> · {{ team.trust_label }}</text></text>
        </view>
        <text class="ui-arrow-text team-result-action">{{ selectedTeam?.id === team.id ? '已选 ✓' : '选择 →' }}</text>
      </view>
    </view>
    <!-- #ifdef MP-WEIXIN -->
    <view v-else-if="!loadError" class="empty-box ui-card-panel">
      <text class="empty-title">{{ searching ? '正在加载球队' : !hasSearched ? '球队列表待加载' : searchKeyword.trim() ? '没有找到匹配的球队' : '暂无可加入的球队' }}</text>
      <text>{{ searching ? '稍等一下，马上就好。' : searchKeyword.trim() ? '试试更短的关键词，或确认球队名称。' : '可以创建自己的球队，邀请球友一起加入。' }}</text>
    </view>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <view v-else class="empty-box ui-card-panel">
      <text class="empty-title">{{ searching ? '正在查找球队' : hasSearched ? '没有找到匹配的球队' : '找到你的球队' }}</text>
      <text>{{ hasSearched ? '试试更短的关键词，或确认球队名称。' : '支持输入部分名称，选择球队后即可加入。' }}</text>
    </view>
    <!-- #endif -->
    <!-- #ifdef MP-WEIXIN -->
    </view>
    <StickyActionBar :visible="confirmationVisible" flat reserve-space enter-from-bottom leave-to-bottom>
    <!-- #endif -->
    <view v-if="confirmation" class="join-panel ui-card-panel">
      <text class="join-panel-title">{{ confirmation.isMember ? '你已加入' : '加入' }} {{ confirmation.team.name }}</text>
      <text class="join-panel-note">{{ confirmation.isMember ? '你已经是该球队成员，可直接查看球队详情。' : confirmation.requiresPassword ? '该球队设置了入队密码，请向队长获取。' : '该球队开放加入，确认后即可成为队员。' }}</text>
      <input v-if="confirmation.requiresPassword && !confirmation.isMember" :value="joinPassword" class="password-input" :disabled="!confirmationVisible" placeholder="请输入入队密码" password @input="updateJoinPassword" />
      <!-- #ifdef MP-WEIXIN -->
      <view class="join-action"><AppButton block :disabled="!confirmationVisible || !canJoin" :loading="submitting" @click="handleJoin"><text class="ui-arrow-text">{{ confirmation.isMember ? '查看球队 →' : submitting ? '加入中…' : '确认加入球队' }}</text></AppButton></view>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="join-action"><AppButton block :disabled="!confirmationVisible || !canJoin" :loading="submitting" @click="handleJoin">{{ confirmation.isMember ? '查看球队 →' : submitting ? '加入中…' : '确认加入球队' }}</AppButton></view>
      <!-- #endif -->
    </view>
    <!-- #ifdef MP-WEIXIN -->
    </StickyActionBar>
    <!-- #endif -->
  </view>
</template>

<style scoped>
@import "@/styles/list-surfaces.css";
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
.empty-box {
  /* #ifndef MP-WEIXIN */
  padding:44rpx 24rpx; border-radius:var(--ui-radius-card); background:var(--ui-color-neutral-bg);
  /* #endif */
  text-align:center; color:var(--ui-color-text-muted); font-size:24rpx; line-height:1.6;
}
.empty-title { display:block; margin-bottom:10rpx; font-size:28rpx; font-weight:600; color:var(--ui-color-text); }
.join-panel {
  margin-top:24rpx;
  /* #ifndef MP-WEIXIN */
  padding:24rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-card); background:var(--ui-color-surface);
  /* #endif */
}
.join-panel-title { display:block; font-size:28rpx; font-weight:600; color:var(--ui-color-text); }
.join-panel-note { display:block; margin-top:10rpx; font-size:24rpx; color:var(--ui-color-text-muted); line-height:1.5; }
.password-input { margin-top:20rpx; height:84rpx; padding:0 20rpx; border:var(--ui-border-default); border-radius:var(--ui-radius-button); font-size:26rpx; color:var(--ui-color-text); }
.join-action { margin-top:24rpx; display:flex; flex-direction:column; align-items:stretch; }

/* #ifdef MP-WEIXIN */
/* 微信端复用统一排版尺度；H5 保留原有样式。 */
.directory-create-entry { display: flex; flex-direction: column; align-items: stretch; margin-top: var(--ui-space-4); }
.directory-error { display: flex; flex-direction: column; gap: var(--ui-space-2); margin-bottom: var(--ui-space-4); font-size: var(--ui-text-body); color: var(--ui-color-danger-fg); }
.search-row { gap: var(--ui-space-3); }
.search-field { gap: var(--ui-space-3); padding: 0 var(--ui-input-padding); height: var(--ui-input-height); border: var(--ui-input-border); border-radius: var(--ui-input-radius); }
.search-icon { margin-right: var(--ui-space-1); }
.search-input { font-size: var(--ui-text-label); }
.results-heading { margin: var(--ui-space-8) 0 var(--ui-space-4); font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.results-count { font-size: var(--ui-text-sm); font-weight: var(--ui-font-weight-body); }
.team-result-list { gap: 0; }
.team-result-card { gap: var(--ui-list-row-gap); padding: var(--ui-list-row-padding) 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); background: transparent; }
.team-logo-fallback { font-size: var(--ui-text-title); font-weight: var(--ui-font-weight-heading); }
.team-result-title { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); }
.team-result-meta { margin-top: var(--ui-space-1); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-body); }
.team-result-action { font-size: var(--ui-text-body); font-weight: var(--ui-font-weight-heading); }
.empty-box { font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.empty-title { margin-bottom: var(--ui-space-2); font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); }
.join-panel { margin-top: 0; }
.join-panel-title { font-size: var(--ui-text-subtitle); font-weight: var(--ui-font-weight-heading); overflow-wrap: anywhere; }
.join-panel-note { margin-top: var(--ui-space-2); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.password-input { width: 100%; box-sizing: border-box; margin-top: var(--ui-space-5); padding: 0 var(--ui-input-padding); font-size: var(--ui-text-label); height: var(--ui-input-height); border: var(--ui-input-border); border-radius: var(--ui-input-radius); background: var(--ui-color-surface); }
.join-action { margin-top: var(--ui-space-6); }
.search-action { width: calc(var(--ui-space-12) * 2); --ui-button-height-sm: var(--ui-input-height); }
.team-result-card + .team-result-card { border-top: var(--ui-list-divider); }
.team-result-card-active { background: var(--ui-control-selected-bg); }
/* #endif */
</style>
