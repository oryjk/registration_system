<script setup lang="ts">
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
  <view class="form-card">
    <text class="form-title">查找已有球队</text>
    <view class="search-row">
      <input
        :value="searchKeyword"
        class="form-input search-input"
        placeholder="输入球队名称"
        confirm-type="search"
        @input="updateSearchKeyword"
        @confirm="handleSearch"
      />
      <view class="search-button" @tap="handleSearch">{{ searching ? "搜索中" : "搜索" }}</view>
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
      <view :class="['primary-button', canJoin ? '' : 'primary-button-disabled']" @tap="handleJoin">
        {{ submitting ? "加入中..." : "确认加入" }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.form-card {
  padding: 30rpx;
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 36rpx rgba(16, 17, 15, 0.06);
}

.form-title {
  display: block;
  margin-bottom: 24rpx;
  color: #10110f;
  font-size: 34rpx;
  font-weight: 900;
}

.form-label,
.team-result-meta {
  color: #6a7165;
  font-size: 24rpx;
  font-weight: 700;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
}

.form-input {
  width: 100%;
  height: 86rpx;
  padding: 0 22rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  color: #111310;
  font-size: 28rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.primary-button,
.search-button {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: #c8ff00;
  color: #10110f;
  font-size: 28rpx;
  font-weight: 900;
}

.primary-button {
  height: 88rpx;
  margin-top: 28rpx;
}

.primary-button-disabled {
  opacity: 0.45;
}

.search-row {
  display: flex;
  gap: 12rpx;
}

.search-input {
  flex: 1;
}

.search-button {
  width: 136rpx;
  height: 86rpx;
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
  border-radius: 24rpx;
  background: #f5f7f1;
  border: 2rpx solid transparent;
}

.team-result-card-active {
  border-color: #c8ff00;
  background: #fbfff0;
}

.team-result-title {
  display: block;
  color: #111310;
  font-size: 30rpx;
  font-weight: 900;
}

.team-result-meta {
  display: block;
  margin-top: 6rpx;
}

.team-result-action {
  color: #111310;
  font-size: 24rpx;
  font-weight: 900;
}

.join-panel,
.empty-box,
.open-team-note {
  margin-top: 22rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f3f5ef;
}

.empty-box,
.open-team-note {
  color: #6b7166;
  font-size: 26rpx;
  font-weight: 700;
}
</style>
