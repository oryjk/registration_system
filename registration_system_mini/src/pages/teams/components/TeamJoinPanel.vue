<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
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
  <AppSurface custom-class="form-card">
    <SectionHeader title="搜索球队" />
    <view class="search-row">
      <input
        :value="searchKeyword"
        class="form-input search-input"
        placeholder="输入球队名称"
        confirm-type="search"
        @input="updateSearchKeyword"
        @confirm="handleSearch"
      />
      <AppButton icon="search-line" class="search-button" variant="lime" :loading="searching" @click="handleSearch">
        {{ searching ? "搜索中" : "搜索" }}
      </AppButton>
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
      <AppButton icon="user-add" block :disabled="!canJoin" :loading="submitting" @click="handleJoin">
        {{ submitting ? "加入中..." : "确认加入" }}
      </AppButton>
    </view>
  </AppSurface>
</template>

<style scoped>
@import "@/styles/form-controls.css";
.form-card {
  padding: 6rpx 24rpx 24rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  box-shadow: var(--ui-shadow-card);
}

.form-label,
.team-result-meta {
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  font-weight: 400;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--ui-color-text);
  font-weight: 600;
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
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-surface);
  box-shadow: var(--ui-shadow-card);
}

.team-result-card-active {
  background: var(--ui-color-success);
  box-shadow: var(--ui-shadow-card);
}

.team-result-title {
  display: block;
  color: var(--ui-color-text);
  font-size: 30rpx;
  font-weight: 600;
}

.team-result-meta {
  display: block;
  margin-top: 6rpx;
}

.team-result-action {
  flex-shrink: 0;
  padding: 8rpx 12rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-xs);
  background: var(--ui-color-accent);
  color: var(--ui-color-text);
  font-size: 24rpx;
  font-weight: 600;
}

.join-panel,
.empty-box,
.open-team-note {
  margin-top: 22rpx;
  padding: 22rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-info-soft);
}

.empty-box,
.open-team-note {
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  font-weight: 400;
}

.empty-box {
  background: var(--ui-color-warning-soft);
}

:deep(.join-panel .ui-button--block) {
  margin-top: 24rpx;
}
</style>
