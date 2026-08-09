<script setup lang="ts">
import { NeoButton, NeoSectionHeader, NeoSurface } from "@/components/neo";
import type { BackendTeamSummary } from "@/types/backend";

defineProps<{
  searchKeyword: string;
  searching: boolean;
  searchResults: BackendTeamSummary[];
  selectedTeam: BackendTeamSummary | null;
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
  <NeoSurface custom-class="form-card">
    <NeoSectionHeader title="查找已有球队" marker="01" caption="搜索球队名称，选择后确认加入" />
    <view class="search-row">
      <input
        :value="searchKeyword"
        class="form-input search-input"
        placeholder="输入球队名称"
        confirm-type="search"
        @input="updateSearchKeyword"
        @confirm="handleSearch"
      />
      <NeoButton class="search-button" variant="lime" :loading="searching" @click="handleSearch">
        {{ searching ? "搜索中" : "搜索" }}
      </NeoButton>
    </view>

    <view v-if="searchResults.length" class="team-result-list">
      <view
        v-for="team in searchResults"
        :key="team.id"
        :class="['team-result-card', selectedTeam?.id === team.id ? 'team-result-card-active' : '']"
        @tap="handleSelectTeam(team)"
      >
        <view>
          <text class="team-result-title">{{ team.name }}</text>
          <text class="team-result-meta">{{ team.member_count }} 人 · 信用 {{ team.credit_score }} · {{ team.trust_label }}</text>
        </view>
        <text class="team-result-action">{{ selectedTeam?.id === team.id ? "已选择" : "选择" }}</text>
      </view>
    </view>
    <view v-else class="empty-box">搜索后会展示可加入的球队。</view>

    <view v-if="selectedTeam" class="join-panel">
      <text class="form-label">加入 {{ selectedTeam.name }}</text>
      <input
        v-if="selectedTeamRequiresPassword"
        :value="joinPassword"
        class="form-input"
        placeholder="请输入入队密码"
        password
        @input="updateJoinPassword"
      />
      <view v-else class="open-team-note">该球队无需入队密码。</view>
      <NeoButton block :disabled="!canJoin" :loading="submitting" @click="handleJoin">
        {{ submitting ? "加入中..." : "确认加入" }}
      </NeoButton>
    </view>
  </NeoSurface>
</template>

<style scoped>
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-text);
}

.form-label,
.team-result-meta {
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  font-weight: 700;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--neo-color-text);
  font-weight: 900;
}

.form-input {
  width: 100%;
  height: 84rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.search-row {
  display: flex;
  gap: 12rpx;
  margin-top: 26rpx;
}

.search-input {
  flex: 1;
}

.search-button {
  width: 142rpx;
  min-height: 84rpx;
}

.team-result-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 22rpx;
}

.team-result-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-surface);
  box-shadow: 4rpx 4rpx 0 var(--neo-color-text);
}

.team-result-card-active {
  background: var(--neo-color-success);
  box-shadow: 2rpx 2rpx 0 var(--neo-color-text);
}

.team-result-title {
  display: block;
  color: var(--neo-color-text);
  font-size: 30rpx;
  font-weight: 900;
}

.team-result-meta {
  display: block;
  margin-top: 6rpx;
}

.team-result-action {
  flex-shrink: 0;
  padding: 8rpx 12rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-xs);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
}

.join-panel,
.empty-box,
.open-team-note {
  margin-top: 22rpx;
  padding: 22rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-info-soft);
}

.empty-box,
.open-team-note {
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  font-weight: 700;
}

.empty-box {
  background: var(--neo-color-warning-soft);
}

:deep(.join-panel .neo-button--block) {
  margin-top: 24rpx;
}
</style>
